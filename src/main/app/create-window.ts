import { appendFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Electron from 'electron';

const { BrowserWindow } = require('electron') as typeof Electron;
const currentDir = dirname(fileURLToPath(import.meta.url));
const mainDir = dirname(currentDir);
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

function resolveAppIconPath(): string | undefined {
  const iconFile = process.platform === 'win32' ? 'SST Sequencer.ico' : 'SST Sequencer.png';
  const candidates = [
    join(process.cwd(), 'build', iconFile),
    join(process.resourcesPath, 'build', iconFile),
    join(mainDir, '../../build', iconFile),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function resolvePreloadPath(): string {
  const candidates = [
    join(mainDir, 'preload/index.cjs'),
    join(mainDir, 'preload/index.mjs'),
    join(process.cwd(), 'out/preload/index.cjs'),
    join(process.cwd(), 'out/preload/index.mjs'),
  ];

  const resolved = candidates.find((candidate) => existsSync(candidate));

  logStartup('resolvePreloadPath', { candidates, resolved });

  if (!resolved) {
    throw new Error(`Preload script was not found. Checked: ${candidates.join(', ')}`);
  }

  return resolved;
}

export function createWindow(): void {
  const preloadPath = resolvePreloadPath();
  const iconPath = resolveAppIconPath();
  logStartup('createWindow:start', { preloadPath, iconPath, mainDir, cwd: process.cwd() });
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 820,
    autoHideMenuBar: true,
    backgroundColor: '#050816',
    title: 'SST Sequencer',
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelLabel = ['log', 'warn', 'error', 'debug', 'info'][level] ?? `level-${level}`;
    console[levelLabel === 'error' ? 'error' : levelLabel === 'warn' ? 'warn' : 'log'](
      `[renderer:${levelLabel}] ${sourceId}:${line} ${message}`
    );
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    logStartup('renderer:gone', details);
    console.error('[renderer:gone]', details.reason, details.exitCode);
  });

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      logStartup('renderer:load-failed', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      });
      console.error('[renderer:load-failed]', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      });
    }
  );

  if (process.env.ELECTRON_RENDERER_URL) {
    logStartup('loadURL', { url: process.env.ELECTRON_RENDERER_URL });
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    const rendererPath = join(mainDir, 'renderer/index.html');
    logStartup('loadFile', { rendererPath, exists: existsSync(rendererPath) });
    void window.loadFile(rendererPath);
  }

  window.webContents.once('did-finish-load', () => {
    logStartup('renderer:did-finish-load');
  });

  window.on('closed', () => {
    logStartup('window:closed');
  });
}
