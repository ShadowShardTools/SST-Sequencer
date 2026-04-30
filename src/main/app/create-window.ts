import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const { BrowserWindow } = electron;
const currentDir = dirname(fileURLToPath(import.meta.url));
const mainDir = dirname(currentDir);

function resolvePreloadPath(): string {
  const candidates = [
    join(mainDir, '../preload/index.mjs'),
    join(process.cwd(), 'out/preload/index.mjs'),
  ];

  const resolved = candidates.find((candidate) => existsSync(candidate));

  if (!resolved) {
    throw new Error(
      `Preload script was not found. Checked: ${candidates.join(', ')}`
    );
  }

  return resolved;
}

export function createWindow(): void {
  const preloadPath = resolvePreloadPath();
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 820,
    autoHideMenuBar: true,
    backgroundColor: '#050816',
    title: 'SST Sequencer',
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
    console.error('[renderer:gone]', details.reason, details.exitCode);
  });

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error('[renderer:load-failed]', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      });
    }
  );

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(mainDir, '../renderer/index.html'));
  }
}
