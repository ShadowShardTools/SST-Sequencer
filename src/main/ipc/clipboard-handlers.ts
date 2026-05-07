import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type * as Electron from 'electron';

const { ipcMain } = require('electron') as typeof Electron;

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/gif': 'gif',
};

export function registerClipboardHandlers(): void {
  ipcMain.handle(
    'clipboard:save-image',
    async (_event, payload: { data: Uint8Array; mimeType: string }) => {
      const bytes = payload?.data ? Buffer.from(payload.data) : null;
      if (!bytes || bytes.length === 0) {
        return null;
      }

      const extension = MIME_EXTENSION_MAP[payload.mimeType] ?? 'png';
      const outputDir = join(tmpdir(), 'sst-sequencer-paste-images');
      await mkdir(outputDir, { recursive: true });

      const filePath = join(outputDir, `pasted-${Date.now()}-${randomUUID()}.${extension}`);
      await writeFile(filePath, bytes);
      return filePath;
    }
  );
}
