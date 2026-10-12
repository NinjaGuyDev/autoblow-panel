/**
 * Preload script.
 *
 * The renderer is the unmodified web app, so it needs nothing from Electron
 * beyond knowing it is running in the desktop build. Everything else still goes
 * over HTTP to the local backend, which keeps one code path for both builds.
 */

import { contextBridge } from 'electron';

/** Passed by electron/main.ts through webPreferences.additionalArguments. */
const APP_VERSION_ARG = '--app-version=';

const appVersion = process.argv.find(arg => arg.startsWith(APP_VERSION_ARG))?.slice(APP_VERSION_ARG.length) ?? '';

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  version: appVersion,
  platform: process.platform,
});
