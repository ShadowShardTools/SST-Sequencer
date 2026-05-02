import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type * as Electron from 'electron';
import type { SequenceInputMode } from '../../shared/formats';
import type { ResolutionMode } from '../../shared/resolution';
import {
  generateSequencePreview,
  inspectSequenceSource,
  inspectVideoSource,
} from '../media-service';

const { ipcMain, nativeImage } = require('electron') as typeof Electron;

export function registerPreviewHandlers(): void {
  ipcMain.handle(
    'source:inspect-sequence',
    async (
      _event,
      input: {
        sourceMode: SequenceInputMode;
        sequenceFolder?: string;
        imagePaths?: string[];
      }
    ) => {
      return inspectSequenceSource(input);
    }
  );

  ipcMain.handle(
    'preview:sequence-video',
    async (
      _event,
      input: {
        sourceMode: SequenceInputMode;
        sequenceFolder?: string;
        imagePaths?: string[];
        fps: number;
        speed: number;
        resolutionMode: ResolutionMode;
        customWidth?: number;
        customHeight?: number;
      }
    ) => {
      return generateSequencePreview(input);
    }
  );

  ipcMain.handle('source:inspect-video', async (_event, videoPath: string) => {
    return inspectVideoSource(videoPath);
  });

  ipcMain.handle('preview:image-data-url', async (_event, filePath: string) => {
    const targetPath = filePath.trim();
    if (!targetPath) {
      return null;
    }

    try {
      const preview = nativeImage.createFromPath(targetPath);
      if (preview.isEmpty()) {
        return null;
      }

      return preview.resize({ width: 176, height: 176, quality: 'good' }).toDataURL();
    } catch {
      return null;
    }
  });

  ipcMain.handle('preview:video-data-url', async (_event, filePath: string) => {
    const targetPath = filePath.trim();
    if (!targetPath) {
      return null;
    }

    try {
      const buffer = await readFile(targetPath);
      const mimeType = getVideoMimeType(targetPath);
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  });
}

function getVideoMimeType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();

  switch (extension) {
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.avi':
      return 'video/x-msvideo';
    case '.mkv':
      return 'video/x-matroska';
    case '.gif':
      return 'image/gif';
    case '.apng':
      return 'image/apng';
    default:
      return 'application/octet-stream';
  }
}
