import {
  getVideoFormatExtension,
  isValidFps,
  isValidSpeed,
  type VideoFormat,
} from '../../../shared/formats';
import type { SequenceSourcePreview, VideoSourcePreview } from '../../../shared/previews';

type DroppedPayload = {
  paths: string[];
  containsDirectory: boolean;
};

type DroppedEntry = {
  isFile: boolean;
  isDirectory: boolean;
  file?: (callback: (file: File) => void) => void;
  createReader?: () => {
    readEntries: (callback: (entries: DroppedEntry[]) => void) => void;
  };
};

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
  '.exr',
]);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.avi', '.mxf', '.webm', '.m4v']);
const DISPLAYABLE_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp']);
const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export function trimNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }

  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function roundToStep(value: number, step: number): number {
  const factor = 1 / step;
  return Math.round(value * factor) / factor;
}

export function clampToRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildPreviewItems(paths: string[] | undefined, max = 4): string[] | undefined {
  if (!paths || paths.length === 0) {
    return undefined;
  }

  const labels = paths.slice(0, max).map((path) => basenameLabel(path));
  const remaining = paths.length - max;

  if (remaining > 0) {
    labels.push(`+${remaining} more`);
  }

  return labels;
}

export function estimateVideoSizeNote(
  preview: SequenceSourcePreview | null,
  fps: number,
  speed: number,
  format: VideoFormat
): string | null {
  if (!preview || !isValidFps(fps) || !isValidSpeed(speed)) {
    return null;
  }

  const width = preview.width ?? 1920;
  const height = preview.height ?? 1080;
  const seconds = preview.frameCount / fps / speed;
  const megapixels = (width * height) / 1_000_000;
  let mbps = 6;

  switch (format) {
    case 'mp4-h264':
      mbps = Math.max(4, megapixels * 4.5);
      break;
    case 'mp4-hevc':
      mbps = Math.max(3, megapixels * 3.2);
      break;
    case 'prores422':
      mbps = Math.max(45, megapixels * 34);
      break;
    case 'webm-vp9':
      mbps = Math.max(2.6, megapixels * 2.8);
      break;
    case 'gif-palette':
      mbps = Math.max(5, megapixels * 5.5);
      break;
    default:
      mbps = 6;
  }

  const estimatedBytes = (mbps * 1_000_000 * seconds) / 8;
  return `Estimated size: about ${formatBytes(estimatedBytes)} for ${trimNumber(seconds)}s.`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${trimNumber(value)} ${units[exponent]}`;
}

export function formatResolution(width?: number, height?: number): string | null {
  if (!width || !height) {
    return null;
  }

  return `${width} x ${height}`;
}

export function getVideoAspectRatio(preview: VideoSourcePreview): string {
  if (!preview.width || !preview.height) {
    return '16 / 9';
  }

  return `${preview.width} / ${preview.height}`;
}

export function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0s';
  }

  if (value >= 60) {
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return `${minutes}m ${trimNumber(seconds)}s`;
  }

  return `${trimNumber(value)}s`;
}

export async function extractDroppedPayload(dataTransfer: DataTransfer): Promise<DroppedPayload> {
  const itemEntries = [...dataTransfer.items]
    .map((item) => getDroppedEntry(item))
    .filter((entry): entry is DroppedEntry => Boolean(entry));

  if (itemEntries.length > 0) {
    const containsDirectory = itemEntries.some((entry) => entry.isDirectory);
    const paths = (
      await Promise.all(itemEntries.map((entry) => collectDroppedEntryPaths(entry)))
    ).flat();

    return {
      containsDirectory,
      paths: sortNaturalPaths(paths),
    };
  }

  const filePaths = (
    await Promise.all(
      [...dataTransfer.files].map((file) => window.mediaApi.getPathForDroppedFile(file))
    )
  ).filter((filePath): filePath is string => Boolean(filePath));

  return {
    containsDirectory: false,
    paths: sortNaturalPaths(filePaths),
  };
}

export function sortNaturalPaths(paths: string[]): string[] {
  return [...paths].sort((left, right) =>
    naturalCollator.compare(basenameLabel(left), basenameLabel(right))
  );
}

export function isImagePath(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(filePath));
}

export function isVideoPath(filePath: string): boolean {
  return VIDEO_EXTENSIONS.has(getExtension(filePath));
}

export function isDisplayableImagePath(filePath: string): boolean {
  return DISPLAYABLE_IMAGE_EXTENSIONS.has(getExtension(filePath));
}

export function getExtension(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() || '';
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : '';
}

export function getParentDirectory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash > 0 ? normalized.slice(0, lastSlash) : normalized;
}

export function basenameLabel(filePath: string): string {
  if (!filePath) {
    return '';
  }

  const normalized = filePath.replace(/\\/g, '/');
  return normalized.split('/').pop() || normalized;
}

export function toFileUrl(filePath: string): string {
  return `file://${filePath.replace(/\\/g, '/').replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
}

export function buildSuggestedVideoName(
  sourcePath: string | undefined,
  format: VideoFormat
): string {
  const sourceName = basenameLabel(sourcePath || 'sequence');
  const ext = getVideoFormatExtension(format);
  const suffixIndex = sourceName.lastIndexOf('.');
  const baseName = suffixIndex > 0 ? sourceName.slice(0, suffixIndex) : sourceName;
  return `${baseName}.${ext}`;
}

function getDroppedEntry(item: DataTransferItem): DroppedEntry | null {
  if ('webkitGetAsEntry' in item && typeof item.webkitGetAsEntry === 'function') {
    return item.webkitGetAsEntry() as DroppedEntry | null;
  }
  return null;
}

async function collectDroppedEntryPaths(entry: DroppedEntry): Promise<string[]> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File | null>((resolve) => {
      entry.file?.((value) => resolve(value ?? null));
    });

    if (!file) {
      return [];
    }

    const filePath = window.mediaApi.getPathForDroppedFile(file);
    return filePath ? [filePath] : [];
  }

  if (entry.isDirectory && entry.createReader) {
    const entries = await new Promise<DroppedEntry[]>((resolve) => {
      const reader = entry.createReader?.();
      if (!reader) {
        resolve([]);
        return;
      }

      const collected: DroppedEntry[] = [];
      const readBatch = (): void => {
        reader.readEntries((batch) => {
          if (batch.length === 0) {
            resolve(collected);
            return;
          }

          collected.push(...batch);
          readBatch();
        });
      };

      readBatch();
    });

    return (await Promise.all(entries.map((child) => collectDroppedEntryPaths(child)))).flat();
  }

  return [];
}
