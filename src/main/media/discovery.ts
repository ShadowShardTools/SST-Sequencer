import { readdir } from 'node:fs/promises';
import { basename, extname, join, parse } from 'node:path';

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
const APP_GENERATED_DIRECTORY_NAMES = new Set(['upscaled_images']);
const APP_GENERATED_DIRECTORY_SUFFIXES = ['_sequence'];
const APP_GENERATED_VIDEO_SUFFIXES = ['_upscaled'];

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
      if (entry.isFile() && isVideoFile(fullPath) && !isGeneratedVideoOutput(fullPath)) {
        files.push(fullPath);
      }

      if (recursive && entry.isDirectory() && !isGeneratedDirectory(entry.name)) {
        pending.push(fullPath);
      }
    }
  }

  return dedupeAndSort(files);
}

export async function discoverImageFiles(
  scanRoot: string | undefined,
  recursive: boolean
): Promise<string[]> {
  const root = scanRoot?.trim();
  if (!root) {
    throw new Error('Choose a source folder to scan for images.');
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
      if (entry.isFile() && isImageFile(fullPath)) {
        files.push(fullPath);
      }

      if (recursive && entry.isDirectory() && !isGeneratedDirectory(entry.name)) {
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

      if ((recursive || current.depth === 0) && !isGeneratedDirectory(entry.name)) {
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

function isGeneratedDirectory(name: string): boolean {
  const normalized = name.toLowerCase();
  if (APP_GENERATED_DIRECTORY_NAMES.has(normalized)) {
    return true;
  }

  return APP_GENERATED_DIRECTORY_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function isGeneratedVideoOutput(filePath: string): boolean {
  const normalized = parse(filePath).name.toLowerCase();
  return APP_GENERATED_VIDEO_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}
