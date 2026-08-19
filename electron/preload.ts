/**
 * Preload script.
 *
 * The renderer is the unmodified web app, so it needs nothing from Electron
 * beyond knowing it is running in the desktop build. Everything else still goes
 * over HTTP to the local backend, which keeps one code path for both builds.
 */

import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  version: process.env.npm_package_version ?? '',
  platform: process.platform,
});
