/**
 * Electron main process.
 *
 * The desktop build reuses the web app unchanged: the same Express backend runs
 * as a child process and serves the same Vite bundle, and the renderer talks to
 * it over http://127.0.0.1 exactly as the browser build talks to nginx. Nothing
 * in src/ or server/ knows it is running inside Electron.
 *
 * User data lives in Electron's per-user directory rather than ./data and
 * ./media, so an installed app never writes next to its own binary.
 */

import { app, BrowserWindow, shell } from 'electron';
import { fork, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** Set by the dev script; when present the renderer loads Vite instead of the built bundle. */
const DEV_SERVER_URL = process.env.ELECTRON_DEV_SERVER_URL;

const BACKEND_READY_TIMEOUT_MS = 30_000;
const BACKEND_POLL_INTERVAL_MS = 250;

let backend: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

/** Ask the OS for a free port so a second app — or a running dev server — cannot collide. */
async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('Could not resolve a free port')));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Start the compiled Express server as a child process.
 *
 * ELECTRON_RUN_AS_NODE makes Electron's own binary behave as plain Node, which
 * is what lets the packaged app run the backend without shipping a second
 * runtime — and keeps better-sqlite3 on the ABI it was rebuilt for.
 */
function startBackend(port: number): ChildProcess {
  const userData = app.getPath('userData');
  const dataDir = path.join(userData, 'data');
  const mediaDir = path.join(userData, 'media');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(mediaDir, { recursive: true });

  const backendEntry = path.join(currentDir, '../dist/server/index.js');
  const staticDir = path.join(currentDir, '../dist');

  const child = fork(backendEntry, [], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      DB_PATH: path.join(dataDir, 'autoblow.db'),
      MEDIA_DIR: mediaDir,
      // Express serves the SPA itself here; nginx does that job in the Docker build
      STATIC_DIR: staticDir,
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });

  child.stdout?.on('data', chunk => process.stdout.write(`[backend] ${chunk}`));
  child.stderr?.on('data', chunk => process.stderr.write(`[backend] ${chunk}`));
  child.on('exit', code => {
    backend = null;
    // A backend that dies takes the app with it — the window would only show errors
    if (code !== 0 && !app.isPackaged) console.error(`[backend] exited with code ${code}`);
    if (mainWindow !== null) app.quit();
  });

  return child;
}

/** Poll /health until the backend answers, so the window never loads against a dead port. */
async function waitForBackend(port: number): Promise<void> {
  const deadline = Date.now() + BACKEND_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      // Not listening yet
    }
    await new Promise(resolve => setTimeout(resolve, BACKEND_POLL_INTERVAL_MS));
  }

  throw new Error(`Backend did not become ready within ${BACKEND_READY_TIMEOUT_MS}ms`);
}

function createWindow(url: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0c0a09',
    show: false,
    webPreferences: {
      // .cjs because a sandboxed preload cannot be an ES module
      preload: path.join(currentDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  // Anything that asks for a new window is an external link — hand it to the browser
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('http://') || target.startsWith('https://')) {
      void shell.openExternal(target);
    }
    return { action: 'deny' };
  });

  void window.loadURL(url);
  return window;
}

function stopBackend(): void {
  if (backend === null) return;
  backend.kill();
  backend = null;
}

async function bootstrap(): Promise<void> {
  if (DEV_SERVER_URL) {
    // `npm run dev` already runs the backend on 3001 and Vite proxies /api to it
    mainWindow = createWindow(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  const port = await findFreePort();
  backend = startBackend(port);
  await waitForBackend(port);
  mainWindow = createWindow(`http://127.0.0.1:${port}`);
}

// A second instance would fight the first over the same SQLite file
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow === null) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(bootstrap).catch((err: unknown) => {
    console.error('Failed to start Autoblow Panel:', err);
    app.quit();
  });

  app.on('window-all-closed', () => {
    stopBackend();
    // macOS convention is to stay resident, but this app owns a device session
    app.quit();
  });

  app.on('before-quit', stopBackend);
}
