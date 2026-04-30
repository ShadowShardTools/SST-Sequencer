import { access, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import electron from 'electron';

const { ipcMain, shell } = electron;

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
