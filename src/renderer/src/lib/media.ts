import {
  applyVideoFormatExtension,
  getVideoFormatExtension,
  isValidFps,
  isValidQuality,
  isValidSpeed,
  type SelectOption,
  type ImageFormat,
  type VideoFormat,
} from '../../../shared/formats';
import type { SequenceSourcePreview, VideoSourcePreview } from '../../../shared/previews';
import {
  resolveResolution,
  type ResolutionDimensions,
  type ResolutionMode,
  type ResolutionSettings,
  type ResolvedResolution,
} from '../../../shared/resolution';

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
const DISPLAYABLE_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.gif',
  '.apng',
]);
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
  format: VideoFormat,
  quality: number,
  targetResolution?: ResolvedResolution | null
): string | null {
  if (!preview || !isValidFps(fps) || !isValidSpeed(speed) || !isValidQuality(quality)) {
    return null;
  }

  const width = targetResolution?.width ?? preview.width ?? 1920;
  const height = targetResolution?.height ?? preview.height ?? 1080;
  const seconds = preview.frameCount / fps / speed;
  const megapixels = (width * height) / 1_000_000;
  let mbps = 6;

  switch (format) {
    case 'mp4-h264':
    case 'mov-h264':
    case 'mkv-h264':
      mbps = Math.max(4, megapixels * 4.5);
      break;
    case 'mp4-hevc':
    case 'mov-hevc':
    case 'mkv-hevc':
      mbps = Math.max(3, megapixels * 3.2);
      break;
    case 'prores422':
      mbps = Math.max(45, megapixels * 34);
      break;
    case 'prores4444':
      mbps = Math.max(65, megapixels * 46);
      break;
    case 'webm-vp9':
      mbps = Math.max(2.6, megapixels * 2.8);
      break;
    case 'apng':
      mbps = Math.max(6, megapixels * 6.5);
      break;
    case 'gif-palette':
      mbps = Math.max(5, megapixels * 5.5);
      break;
    default:
      mbps = 6;
  }

  const qualityFactor = 0.35 + (quality / 100) * 1.65;
  mbps *= qualityFactor;

  const estimatedBytes = (mbps * 1_000_000 * seconds) / 8;
  return `Estimated size: about ${formatBytes(estimatedBytes)} for ${trimNumber(seconds)}s.`;
}

export function getVideoQualityNote(format: VideoFormat, quality: number): string {
  const clampedQuality = clampToRange(Math.round(quality), 1, 100);

  switch (format) {
    case 'mp4-h264':
    case 'mov-h264':
    case 'mkv-h264':
      return `H.264 target: CRF ${mapQualityToRange(clampedQuality, 40)}. 100% is least compressed.`;
    case 'mp4-hevc':
    case 'mov-hevc':
    case 'mkv-hevc':
      return `H.265 target: CRF ${mapQualityToRange(clampedQuality, 40)}. 100% is least compressed.`;
    case 'webm-vp9':
      return `VP9 target: CRF ${mapQualityToRange(clampedQuality, 63)}. Lower CRF means larger files.`;
    case 'prores422':
    case 'prores4444':
      return `ProRes target: qscale ${mapQualityToQscale(clampedQuality)}. Files stay relatively large even at lower quality.`;
    case 'apng':
      return `APNG uses PNG compression level ${mapQualityToPngCompressionLevel(clampedQuality)}. Visual quality stays lossless.`;
    case 'gif-palette':
      return `GIF palette: ${mapQualityToGifColors(clampedQuality)} colors. Lower quality reduces the palette size.`;
    default:
      return 'Higher quality means less compression and larger files.';
  }
}

export function getImageQualityNote(format: ImageFormat, quality: number): string {
  const clampedQuality = clampToRange(Math.round(quality), 1, 100);

  switch (format) {
    case 'jpg':
      return `JPEG target: qscale ${mapQualityToJpegQscale(clampedQuality)}. 100% is least compressed.`;
    case 'webp':
      return `WebP target: quality ${clampedQuality}. Higher quality means larger files.`;
    case 'png':
      return `PNG uses compression level ${mapQualityToPngCompressionLevel(clampedQuality)}. Visual quality stays lossless.`;
    case 'tiff':
      return 'TIFF exports are effectively lossless. Quality has little to no visible effect.';
    case 'bmp':
      return 'BMP exports are uncompressed. Quality does not change the output.';
    case 'tga':
      return 'TGA exports are effectively uncompressed. Quality does not change the output.';
    default:
      return 'Higher quality means less compression and larger files.';
  }
}

export type ImageAdjustmentUi = {
  label: string;
  note: string;
  minLabel?: string;
  maxLabel?: string;
  valueLabel?: string;
  adjustable: boolean;
};

export type ResolutionControlUi = {
  options: Array<SelectOption<ResolutionMode>>;
  note: string;
  resolved: ResolvedResolution | null;
};

export function getImageAdjustmentUi(format: ImageFormat, quality: number): ImageAdjustmentUi {
  const clampedQuality = clampToRange(Math.round(quality), 1, 100);

  switch (format) {
    case 'jpg':
      return {
        label: 'Image quality',
        note: getImageQualityNote(format, clampedQuality),
        minLabel: 'Smaller file',
        maxLabel: 'Best quality',
        valueLabel: `${clampedQuality}%`,
        adjustable: true,
      };
    case 'webp':
      return {
        label: 'Image quality',
        note: getImageQualityNote(format, clampedQuality),
        minLabel: 'Smaller file',
        maxLabel: 'Best quality',
        valueLabel: `${clampedQuality}%`,
        adjustable: true,
      };
    case 'png':
      return {
        label: 'Compression',
        note: getImageQualityNote(format, clampedQuality),
        minLabel: 'Smaller file',
        maxLabel: 'Faster encode',
        valueLabel: `Level ${mapQualityToPngCompressionLevel(clampedQuality)}`,
        adjustable: true,
      };
    case 'bmp':
      return {
        label: 'Compression',
        note: getImageQualityNote(format, clampedQuality),
        adjustable: false,
      };
    case 'tga':
      return {
        label: 'Compression',
        note: getImageQualityNote(format, clampedQuality),
        adjustable: false,
      };
    case 'tiff':
      return {
        label: 'Compression',
        note: getImageQualityNote(format, clampedQuality),
        adjustable: false,
      };
    default:
      return {
        label: 'Image quality',
        note: getImageQualityNote(format, clampedQuality),
        minLabel: 'Smaller file',
        maxLabel: 'Best quality',
        valueLabel: `${clampedQuality}%`,
        adjustable: true,
      };
  }
}

export function getResolutionControlUi(
  settings: ResolutionSettings,
  source: ResolutionDimensions | null,
  outputKind: 'video' | 'images'
): ResolutionControlUi {
  const resolved = resolveResolution(settings, source ?? {}, {
    enforceEven: outputKind === 'video',
  });
  const sourceLabel = formatResolution(source?.width, source?.height);

  const options: Array<SelectOption<ResolutionMode>> = [
    {
      value: 'source',
      label: sourceLabel ? `Source (${sourceLabel})` : 'Source resolution',
    },
    {
      value: 'half',
      label: buildResolutionOptionLabel('1/2 of source', source, { resolutionMode: 'half' }, outputKind),
    },
    {
      value: 'quarter',
      label: buildResolutionOptionLabel(
        '1/4 of source',
        source,
        { resolutionMode: 'quarter' },
        outputKind
      ),
    },
    {
      value: 'eighth',
      label: buildResolutionOptionLabel(
        '1/8 of source',
        source,
        { resolutionMode: 'eighth' },
        outputKind
      ),
    },
    {
      value: 'custom',
      label: 'Custom',
    },
  ];

  if (!resolved) {
    return {
      options,
      resolved: null,
      note:
        settings.resolutionMode === 'source'
          ? 'Uses the source resolution once a source is loaded.'
          : 'Load a source to preview the output resolution.',
    };
  }

  const outputLabel = formatResolution(resolved.width, resolved.height) ?? 'Unknown';
  if (settings.resolutionMode === 'source') {
    return {
      options,
      resolved,
      note: `Output resolution: ${outputLabel}.`,
    };
  }

  if (settings.resolutionMode === 'custom') {
    return {
      options,
      resolved,
      note: `Custom output resolution: ${outputLabel}. Width and height stay aligned to the source aspect ratio while you edit them.`,
    };
  }

  return {
    options,
    resolved,
    note: `Output resolution: ${outputLabel}.`,
  };
}

export function getAspectLockedDimensions(
  source: ResolutionDimensions | null,
  nextWidth: number | undefined,
  nextHeight: number | undefined,
  lockedEdge: 'width' | 'height'
): ResolvedResolution | null {
  if (!source?.width || !source.height) {
    return null;
  }

  if (lockedEdge === 'width' && nextWidth && nextWidth > 0) {
    return {
      width: nextWidth,
      height: Math.max(2, Math.round((nextWidth / source.width) * source.height / 2) * 2),
    };
  }

  if (lockedEdge === 'height' && nextHeight && nextHeight > 0) {
    return {
      width: Math.max(2, Math.round((nextHeight / source.height) * source.width / 2) * 2),
      height: nextHeight,
    };
  }

  return null;
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

export function replacePathExtension(filePath: string, format: VideoFormat): string {
  return applyVideoFormatExtension(filePath, format);
}

function mapQualityToRange(quality: number, maxValue: number): number {
  const normalized = clampToRange((100 - quality) / 99, 0, 1);
  return Math.round(normalized * maxValue);
}

function mapQualityToQscale(quality: number): number {
  const normalized = clampToRange((100 - quality) / 99, 0, 1);
  return Math.max(1, Math.round(1 + normalized * 30));
}

function mapQualityToJpegQscale(quality: number): number {
  const normalized = clampToRange((100 - quality) / 99, 0, 1);
  return Math.max(1, Math.round(1 + normalized * 30));
}

function mapQualityToPngCompressionLevel(quality: number): number {
  const normalized = clampToRange((100 - quality) / 99, 0, 1);
  return Math.round(normalized * 9);
}

function mapQualityToGifColors(quality: number): number {
  const normalized = clampToRange((quality - 1) / 99, 0, 1);
  return Math.max(16, Math.round(16 + normalized * 240));
}

function buildResolutionOptionLabel(
  baseLabel: string,
  source: ResolutionDimensions | null,
  settings: ResolutionSettings,
  outputKind: 'video' | 'images'
): string {
  const resolved = resolveResolution(settings, source ?? {}, {
    enforceEven: outputKind === 'video',
  });

  if (!resolved) {
    return baseLabel;
  }

  return `${baseLabel} (${resolved.width} x ${resolved.height})`;
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
