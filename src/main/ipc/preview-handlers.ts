import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import electron from 'electron';
import type { SequenceInputMode } from '../../shared/formats';
import {
  generateSequencePreview,
  inspectSequenceSource,
  inspectVideoSource,
} from '../media-service';

const { ipcMain, nativeImage } = electron;

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
      return 'video/mp4';
    default:
      return 'application/octet-stream';
  }
}
