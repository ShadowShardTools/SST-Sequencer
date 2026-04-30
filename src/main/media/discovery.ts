import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
  '.tga',
  '.exr',
]);
const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.mxf',
  '.webm',
  '.m4v',
  '.gif',
  '.apng',
]);
const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export function dedupeAndSort(paths: string[]): string[] {
  return [...new Set(paths)].sort((left, right) =>
    naturalCollator.compare(basename(left), basename(right))
  );
}

export async function discoverVideoFiles(
  scanRoot: string | undefined,
  recursive: boolean
): Promise<string[]> {
  const root = scanRoot?.trim();
  if (!root) {
    throw new Error('Choose a source folder to scan for videos.');
  }

  const files: string[] = [];
  const pending = [root];

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current) {
      continue;
    }

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isFile() && isVideoFile(fullPath)) {
        files.push(fullPath);
      }

      if (recursive && entry.isDirectory()) {
        pending.push(fullPath);
      }
    }
  }

  return dedupeAndSort(files);
}

export async function discoverSequenceFolders(
  scanRoot: string | undefined,
  recursive: boolean
): Promise<string[]> {
  const root = scanRoot?.trim();
  if (!root) {
    throw new Error('Choose a source folder to scan for image sequences.');
  }

  const discovered = new Set<string>();
  const pending: Array<{ path: string; depth: number }> = [{ path: root, depth: 0 }];

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current) {
      continue;
    }

    const entries = await readdir(current.path, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() && isImageFile(entry.name))) {
      discovered.add(current.path);
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (recursive || current.depth === 0) {
        pending.push({
          path: join(current.path, entry.name),
          depth: current.depth + 1,
        });
      }
    }
  }

  return dedupeAndSort([...discovered]);
}

export async function getImageFilesFromFolder(folderPath: string): Promise<string[]> {
  const entries = await readdir(folderPath, { withFileTypes: true });
  const images = entries
    .filter((entry) => entry.isFile() && isImageFile(entry.name))
    .map((entry) => join(folderPath, entry.name));

  return dedupeAndSort(images);
}

function isImageFile(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function isVideoFile(filePath: string): boolean {
  return VIDEO_EXTENSIONS.has(extname(filePath).toLowerCase());
}
