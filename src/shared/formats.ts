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
export type UpscaleMode = 'off' | '2x' | '3x' | '4x';
export type UpscalerType =
  | 'realesrgan-anime-video'
  | 'realcugan'
  | 'waifu2x'
  | 'realsr'
  | 'swinir'
  | 'dat'
  | 'anime4kcpp'
  | 'xbr-js'
  | 'pixel-scale-epx'
  | 'nearest';
export type AlphaMode = 'auto' | 'straight' | 'premultiplied';
export type SequenceInputMode = 'folder' | 'images';
export type BatchOutputMode = 'for-each' | 'custom-root';
export type BatchVideoSourceMode = 'files' | 'scan-root';
export type BatchSequenceSourceMode = 'folders' | 'scan-root';

export type SelectOption<TValue extends string> = {
  value: TValue;
  label: string;
};

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
export const UPSCALE_OPTIONS: ReadonlyArray<SelectOption<UpscaleMode>> = [
  { value: 'off', label: 'Off' },
  { value: '2x', label: '2x' },
  { value: '3x', label: '3x' },
  { value: '4x', label: '4x' },
];
export const UPSCALER_OPTIONS: ReadonlyArray<SelectOption<UpscalerType>> = [
  {
    value: 'realesrgan-anime-video',
    label: 'Anime / stylized - Real-ESRGAN Anime Video v3',
  },
  {
    value: 'realcugan',
    label: 'Anime / stylized - Real-CUGAN',
  },
  {
    value: 'waifu2x',
    label: 'Anime / stylized - Waifu2x',
  },
  {
    value: 'realsr',
    label: 'General photo - RealSR',
  },
  {
    value: 'swinir',
    label: 'General clean - SwinIR',
  },
  {
    value: 'dat',
    label: 'General detailed - DAT',
  },
  {
    value: 'anime4kcpp',
    label: 'Anime / stylized - Anime4KCPP',
  },
  {
    value: 'xbr-js',
    label: 'Pixel art only - xBR.js',
  },
  {
    value: 'pixel-scale-epx',
    label: 'Pixel art only - EPX / Scale2x',
  },
  {
    value: 'nearest',
    label: 'Pixel art - Nearest neighbor',
  },
];
export const ALPHA_MODE_OPTIONS: ReadonlyArray<SelectOption<AlphaMode>> = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'straight', label: 'Force straight alpha' },
  { value: 'premultiplied', label: 'Force premultiplied alpha' },
];
export const VIDEO_OUTPUT_EXTENSIONS = ['mp4', 'mov', 'mkv', 'webm', 'gif', 'apng'] as const;

export function getSupportedUpscalerOptions(
  platform: NodeJS.Platform | string
): ReadonlyArray<SelectOption<UpscalerType>> {
  return UPSCALER_OPTIONS.filter((option) => isUpscalerSupportedOnPlatform(option.value, platform));
}

export function getSupportedUpscalerValues(
  platform: NodeJS.Platform | string
): ReadonlyArray<UpscalerType> {
  return getSupportedUpscalerOptions(platform).map((option) => option.value);
}

export function getDefaultUpscalerForPlatform(platform: NodeJS.Platform | string): UpscalerType {
  return getSupportedUpscalerValues(platform)[0] ?? 'nearest';
}

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

export function isValidUpscaleMode(value: string): value is UpscaleMode {
  return value === 'off' || value === '2x' || value === '3x' || value === '4x';
}

export function isValidUpscalerType(value: string): value is UpscalerType {
  return (
    value === 'realesrgan-anime-video' ||
    value === 'realcugan' ||
    value === 'waifu2x' ||
    value === 'realsr' ||
    value === 'swinir' ||
    value === 'dat' ||
    value === 'anime4kcpp' ||
    value === 'xbr-js' ||
    value === 'pixel-scale-epx' ||
    value === 'nearest'
  );
}

export function isValidAlphaMode(value: string): value is AlphaMode {
  return value === 'auto' || value === 'straight' || value === 'premultiplied';
}

export function getAlphaModeLabel(value: AlphaMode): string {
  switch (value) {
    case 'straight':
      return 'Straight alpha';
    case 'premultiplied':
      return 'Premultiplied alpha';
    case 'auto':
    default:
      return 'Auto-detect';
  }
}

export function isUpscalerSupportedOnPlatform(
  upscaler: UpscalerType,
  platform: NodeJS.Platform | string
): boolean {
  switch (upscaler) {
    case 'anime4kcpp':
      return platform === 'win32';
    case 'waifu2x':
    case 'realsr':
    case 'swinir':
    case 'dat':
    case 'xbr-js':
    case 'pixel-scale-epx':
    case 'realesrgan-anime-video':
    case 'realcugan':
    case 'nearest':
    default:
      return true;
  }
}

export function getUpscaleFactor(mode: UpscaleMode): number {
  switch (mode) {
    case '2x':
      return 2;
    case '3x':
      return 3;
    case '4x':
      return 4;
    case 'off':
    default:
      return 1;
  }
}

export function getUpscalerLabel(value: UpscalerType): string {
  switch (value) {
    case 'nearest':
      return 'Nearest neighbor';
    case 'anime4kcpp':
      return 'Anime4KCPP';
    case 'waifu2x':
      return 'Waifu2x';
    case 'realsr':
      return 'RealSR';
    case 'swinir':
      return 'SwinIR';
    case 'dat':
      return 'DAT';
    case 'xbr-js':
      return 'xBR.js';
    case 'pixel-scale-epx':
      return 'EPX / Scale2x';
    case 'realcugan':
      return 'Real-CUGAN';
    case 'realesrgan-anime-video':
    default:
      return 'Real-ESRGAN Anime Video v3';
  }
}

export function imageFormatSupportsAlpha(format: ImageFormat): boolean {
  return format === 'png' || format === 'webp' || format === 'tiff' || format === 'tga';
}

export function videoFormatSupportsAlpha(format: VideoFormat): boolean {
  return format === 'apng' || format === 'prores4444';
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
