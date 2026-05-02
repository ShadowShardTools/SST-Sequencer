import type * as Electron from 'electron';
import {
  applyVideoFormatExtension,
  getVideoFormatExtension,
  getVideoFormatLabel,
  type VideoFormat,
} from '../../shared/formats';

const { dialog, ipcMain } = require('electron') as typeof Electron;

const IMAGE_FILTERS = [
  {
    name: 'Images',
    extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tif', 'tiff', 'tga', 'exr'],
  },
];

const VIDEO_FILTERS = [
  {
    name: 'Videos',
    extensions: ['mp4', 'mov', 'mkv', 'avi', 'mxf', 'webm', 'm4v', 'gif', 'apng'],
  },
];
export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:pick-image-files', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: IMAGE_FILTERS,
    });

    return canceled ? [] : filePaths;
  });

  ipcMain.handle('dialog:pick-sequence-folders', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'multiSelections'],
    });

    return canceled ? [] : filePaths;
  });

  ipcMain.handle('dialog:pick-video-files', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: VIDEO_FILTERS,
    });

    return canceled ? [] : filePaths;
  });

  ipcMain.handle('dialog:pick-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });

    return canceled ? null : (filePaths[0] ?? null);
  });

  ipcMain.handle(
    'dialog:save-video-file',
    async (_event, defaultName: string, format: VideoFormat) => {
      const extension = getVideoFormatExtension(format);
      const label = getVideoFormatLabel(format);
      const suggestedName = applyVideoFormatExtension(defaultName.trim() || 'sequence', format);
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: suggestedName,
        filters: [
          {
            name: label,
            extensions: [extension],
          },
        ],
      });

      return canceled ? null : (filePath ?? null);
    }
  );
}
