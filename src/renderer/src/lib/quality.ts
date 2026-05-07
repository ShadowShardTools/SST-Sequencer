import {
  isValidFps,
  isValidQuality,
  isValidSpeed,
  type ImageFormat,
  type VideoFormat,
} from '../../../shared/formats';
import type { SequenceSourcePreview } from '../../../shared/previews';
import type { ResolvedResolution } from '../../../shared/resolution';
import type { UpscaleMode } from '../../../shared/upscalers/registry';
import { formatBytes } from './formatters';
import { clampToRange, trimNumber } from './numeric';
import { applyUpscaleResolution } from './resolution-ui';

export function estimateVideoSizeNote(
  preview: SequenceSourcePreview | null,
  fps: number,
  speed: number,
  format: VideoFormat,
  quality: number,
  targetResolution?: ResolvedResolution | null,
  upscaleMode: UpscaleMode = 'off'
): string | null {
  if (!preview || !isValidFps(fps) || !isValidSpeed(speed) || !isValidQuality(quality)) {
    return null;
  }

  const scaledResolution = applyUpscaleResolution(targetResolution ?? null, upscaleMode);
  const width = scaledResolution?.width ?? targetResolution?.width ?? preview.width ?? 1920;
  const height = scaledResolution?.height ?? targetResolution?.height ?? preview.height ?? 1080;
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
