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

import { app, BrowserWindow, dialog, shell } from 'electron';
import { fork, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** Set by the dev script; when present the renderer loads Vite instead of the built bundle. */
const DEV_SERVER_URL = process.env.ELECTRON_DEV_SERVER_URL;

/** Must match the flag electron/preload.ts parses out of process.argv. */
const APP_VERSION_ARG = '--app-version=';

const BACKEND_READY_TIMEOUT_MS = 30_000;
/** How long quitting waits for the backend to finish in-flight requests before killing it. */
const BACKEND_SHUTDOWN_TIMEOUT_MS = 10_000;

/** Sent by server/index.ts once it is bound. */
interface BackendListeningMessage {
  type: 'listening';
  port: number;
}

let backend: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let backendStopping = false;

/**
 * Start the compiled Express server as a child process.
 *
 * ELECTRON_RUN_AS_NODE makes Electron's own binary behave as plain Node, which
 * is what lets the packaged app run the backend without shipping a second
 * runtime — and keeps better-sqlite3 on the ABI it was rebuilt for.
 */
function startBackend(): ChildProcess {
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
      // Port 0 lets the OS pick a free port at bind time; the backend reports it over IPC
      PORT: '0',
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

/** Resolve with the port the backend bound, or reject if it exits or stalls before listening. */
async function waitForListening(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Backend did not start listening within ${BACKEND_READY_TIMEOUT_MS}ms`));
    }, BACKEND_READY_TIMEOUT_MS);

    const onMessage = (message: unknown) => {
      if (!isListeningMessage(message)) return;
      cleanup();
      resolve(message.port);
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`Backend exited with code ${code} before it started listening`));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      child.off('message', onMessage);
      child.off('exit', onExit);
    };

    child.on('message', onMessage);
    child.once('exit', onExit);
  });
}

function isListeningMessage(message: unknown): message is BackendListeningMessage {
  const candidate = message as Partial<BackendListeningMessage> | null;
  return candidate?.type === 'listening' && typeof candidate.port === 'number';
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
      // The preload cannot read the packaged version itself; npm_package_version
      // only exists when launched through an npm script
      additionalArguments: [`${APP_VERSION_ARG}${app.getVersion()}`],
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

function requestBackendShutdown(child: ChildProcess): void {
  // kill() is a forced termination on Windows, so ask over IPC for the same
  // graceful close that SIGTERM gets on Linux and macOS
  if (child.connected) child.send({ type: 'shutdown' });
  else child.kill();
}

/**
 * Hold the quit until the backend has exited. On Windows the forked child sits in
 * libuv's kill-on-close job object and dies the moment Electron exits, which would
 * cut off an in-flight upload; elsewhere it would outlive the single-instance lock.
 */
function holdQuitUntilBackendExits(event: Electron.Event): void {
  const child = backend;
  if (child === null) return;

  event.preventDefault();
  if (backendStopping) return;
  backendStopping = true;

  const forceKill = setTimeout(() => child.kill(), BACKEND_SHUTDOWN_TIMEOUT_MS);
  // startBackend's exit handler clears `backend`, so this quit goes through
  child.once('exit', () => {
    clearTimeout(forceKill);
    app.quit();
  });
  requestBackendShutdown(child);
}

async function bootstrap(): Promise<void> {
  if (DEV_SERVER_URL) {
    // `npm run dev` already runs the backend on 3001 and Vite proxies /api to it
    mainWindow = createWindow(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  backend = startBackend();
  const port = await waitForListening(backend);
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
    // A packaged app has no visible console, so this dialog is the only report the user gets
    dialog.showErrorBox('Autoblow Panel failed to start', err instanceof Error ? err.message : String(err));
    app.quit();
  });

  // macOS convention is to stay resident, but this app owns a device session
  app.on('window-all-closed', () => app.quit());

  app.on('before-quit', holdQuitUntilBackendExits);
}
