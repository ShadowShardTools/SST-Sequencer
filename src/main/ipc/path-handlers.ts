import { access, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import type * as Electron from 'electron';

const { ipcMain, shell } = require('electron') as typeof Electron;

export function registerPathHandlers(): void {
  ipcMain.handle('paths:reveal', async (_event, targetPath: string) => {
    if (!targetPath) {
      return;
    }

    try {
      await access(targetPath);
      const stats = await stat(targetPath);

      if (stats.isDirectory()) {
        await shell.openPath(targetPath);
      } else {
        shell.showItemInFolder(targetPath);
      }
    } catch {
      const parentFolder = dirname(targetPath);
      await shell.openPath(parentFolder);
    }
  });
}
