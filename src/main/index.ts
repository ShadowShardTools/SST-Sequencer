import { appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type * as Electron from 'electron';
import { createWindow } from './app/create-window';
import { registerIpcHandlers } from './ipc/register-handlers';

const { app, BrowserWindow } = require('electron') as typeof Electron;
const startupLogPath = join(tmpdir(), 'sst-sequencer-startup.log');

function logStartup(message: string, details?: unknown): void {
  const suffix = details === undefined ? '' : ` ${safeStringify(details)}`;
  appendFileSync(startupLogPath, `[${new Date().toISOString()}] ${message}${suffix}\n`);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

process.on('uncaughtException', (error) => {
  logStartup('uncaughtException', {
    message: error.message,
    stack: error.stack,
  });
});

process.on('unhandledRejection', (reason) => {
  logStartup('unhandledRejection', reason);
});

app.whenReady().then(() => {
  logStartup('app:ready');
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      logStartup('app:activate:createWindow');
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logStartup('app:window-all-closed', { platform: process.platform });
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
