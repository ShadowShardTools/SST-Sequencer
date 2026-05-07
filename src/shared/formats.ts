import type { SelectOption } from './upscalers/registry';

export * from './upscalers/registry';

export type VideoFormat =
  | 'mp4-h264'
  | 'mp4-hevc'
  | 'mov-h264'
  | 'mov-hevc'
  | 'mkv-h264'
  | 'mkv-hevc'
  | 'prores422'
  | 'prores4444'
  | 'webm-vp9'
  | 'apng'
  | 'gif-palette';

export type ImageFormat = 'png' | 'jpg' | 'webp' | 'bmp' | 'tiff' | 'tga';
export type BackgroundRemoveModel =
  | 'birefnet-general'
  | 'birefnet-general-lite'
  | 'birefnet-portrait'
  | 'u2net'
  | 'u2netp'
  | 'u2net_human_seg'
  | 'isnet-general-use'
  | 'isnet-anime';
export type SequenceInputMode = 'folder' | 'images';
export type BatchOutputMode = 'for-each' | 'custom-root';
export type BatchVideoSourceMode = 'files' | 'scan-root';
export type BatchImageSourceMode = 'files' | 'scan-root';
export type BatchSequenceSourceMode = 'folders' | 'scan-root';

export const RATE_LIMITS = {
  fps: {
    min: 1,
    max: 120,
    step: 1,
  },
  speed: {
    min: 0.25,
    max: 8,
    step: 0.25,
  },
} as const;

export const QUALITY_LIMITS = {
  video: {
    min: 1,
    max: 100,
    step: 1,
  },
  image: {
    min: 1,
    max: 100,
    step: 1,
  },
} as const;

export const VIDEO_FORMAT_OPTIONS: ReadonlyArray<SelectOption<VideoFormat>> = [
  { value: 'mp4-h264', label: 'MP4 (H.264)' },
  { value: 'mp4-hevc', label: 'MP4 (H.265 / HEVC)' },
  { value: 'mov-h264', label: 'MOV (H.264)' },
  { value: 'mov-hevc', label: 'MOV (H.265 / HEVC)' },
  { value: 'mkv-h264', label: 'MKV (H.264)' },
  { value: 'mkv-hevc', label: 'MKV (H.265 / HEVC)' },
  { value: 'prores422', label: 'ProRes 422' },
  { value: 'prores4444', label: 'ProRes 4444' },
  { value: 'webm-vp9', label: 'WebM (VP9)' },
  { value: 'apng', label: 'APNG (animated PNG)' },
  { value: 'gif-palette', label: 'GIF (palette)' },
];

export const IMAGE_FORMAT_OPTIONS: ReadonlyArray<SelectOption<ImageFormat>> = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WEBP' },
  { value: 'bmp', label: 'BMP' },
  { value: 'tiff', label: 'TIFF' },
  { value: 'tga', label: 'TGA' },
];

export const BACKGROUND_REMOVE_MODEL_OPTIONS: ReadonlyArray<SelectOption<BackgroundRemoveModel>> = [
  { value: 'birefnet-general', label: 'BiRefNet General' },
  { value: 'birefnet-general-lite', label: 'BiRefNet General Lite (faster)' },
  { value: 'birefnet-portrait', label: 'BiRefNet Portrait' },
  { value: 'u2net', label: 'U2Net' },
  { value: 'u2netp', label: 'U2NetP (lightweight)' },
  { value: 'u2net_human_seg', label: 'U2Net Human' },
  { value: 'isnet-general-use', label: 'ISNet General Use' },
  { value: 'isnet-anime', label: 'ISNet Anime' },
];

export const VIDEO_OUTPUT_EXTENSIONS = ['mp4', 'mov', 'mkv', 'webm', 'gif', 'apng'] as const;

export function getVideoFormatExtension(format: VideoFormat): string {
  switch (format) {
    case 'mov-h264':
    case 'mov-hevc':
    case 'prores422':
    case 'prores4444':
      return 'mov';
    case 'mkv-h264':
    case 'mkv-hevc':
      return 'mkv';
    case 'webm-vp9':
      return 'webm';
    case 'apng':
      return 'apng';
    case 'gif-palette':
      return 'gif';
    case 'mp4-hevc':
    case 'mp4-h264':
    default:
      return 'mp4';
  }
}

export function getVideoFormatLabel(format: VideoFormat): string {
  switch (format) {
    case 'mp4-h264':
      return 'MP4 (H.264)';
    case 'mp4-hevc':
      return 'MP4 (H.265 / HEVC)';
    case 'mov-h264':
      return 'MOV (H.264)';
    case 'mov-hevc':
      return 'MOV (H.265 / HEVC)';
    case 'mkv-h264':
      return 'MKV (H.264)';
    case 'mkv-hevc':
      return 'MKV (H.265 / HEVC)';
    case 'prores422':
      return 'ProRes 422';
    case 'prores4444':
      return 'ProRes 4444';
    case 'webm-vp9':
      return 'WebM (VP9)';
    case 'apng':
      return 'APNG (animated PNG)';
    case 'gif-palette':
      return 'GIF (palette)';
    default:
      return 'Video';
  }
}

export function applyVideoFormatExtension(filePath: string, format: VideoFormat): string {
  const trimmed = filePath.trim();
  if (!trimmed) {
    return trimmed;
  }

  return `${stripKnownVideoOutputExtensions(trimmed)}.${getVideoFormatExtension(format)}`;
}

export function isValidFps(value: number): boolean {
  return Number.isFinite(value) && value >= RATE_LIMITS.fps.min && value <= RATE_LIMITS.fps.max;
}

export function isValidSpeed(value: number): boolean {
  return Number.isFinite(value) && value >= RATE_LIMITS.speed.min && value <= RATE_LIMITS.speed.max;
}

export function isValidQuality(value: number): boolean {
  return (
    Number.isFinite(value) && value >= QUALITY_LIMITS.video.min && value <= QUALITY_LIMITS.video.max
  );
}

export function imageFormatSupportsAlpha(format: ImageFormat): boolean {
  return format === 'png' || format === 'webp' || format === 'tiff' || format === 'tga';
}

export function videoFormatSupportsAlpha(format: VideoFormat): boolean {
  return format === 'apng' || format === 'prores4444';
}

export function isValidBackgroundRemoveModel(value: string): value is BackgroundRemoveModel {
  return BACKGROUND_REMOVE_MODEL_OPTIONS.some((option) => option.value === value);
}

function stripKnownVideoOutputExtensions(filePath: string): string {
  let result = filePath;

  while (true) {
    const dotIndex = result.lastIndexOf('.');
    if (dotIndex <= 0) {
      return result;
    }

    const extension = result.slice(dotIndex + 1).toLowerCase();
    if (!VIDEO_OUTPUT_EXTENSIONS.includes(extension as (typeof VIDEO_OUTPUT_EXTENSIONS)[number])) {
      return result;
    }

    result = result.slice(0, dotIndex);
  }
}
