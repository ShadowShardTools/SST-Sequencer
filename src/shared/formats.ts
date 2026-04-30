export type VideoFormat = 'mp4-h264' | 'mp4-hevc' | 'prores422' | 'webm-vp9' | 'gif-palette';

export type ImageFormat = 'png' | 'jpg' | 'webp';
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

export const VIDEO_FORMAT_OPTIONS: ReadonlyArray<SelectOption<VideoFormat>> = [
  { value: 'mp4-h264', label: 'MP4 (H.264)' },
  { value: 'mp4-hevc', label: 'MP4 (H.265 / HEVC)' },
  { value: 'prores422', label: 'ProRes 422' },
  { value: 'webm-vp9', label: 'WebM (VP9)' },
  { value: 'gif-palette', label: 'GIF (palette)' },
];

export const IMAGE_FORMAT_OPTIONS: ReadonlyArray<SelectOption<ImageFormat>> = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WEBP' },
];

export function getVideoFormatExtension(format: VideoFormat): string {
  switch (format) {
    case 'prores422':
      return 'mov';
    case 'webm-vp9':
      return 'webm';
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
    case 'prores422':
      return 'ProRes 422';
    case 'webm-vp9':
      return 'WebM (VP9)';
    case 'gif-palette':
      return 'GIF (palette)';
    default:
      return 'Video';
  }
}

export function isValidFps(value: number): boolean {
  return Number.isFinite(value) && value >= RATE_LIMITS.fps.min && value <= RATE_LIMITS.fps.max;
}

export function isValidSpeed(value: number): boolean {
  return Number.isFinite(value) && value >= RATE_LIMITS.speed.min && value <= RATE_LIMITS.speed.max;
}
