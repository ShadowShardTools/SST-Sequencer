import { describe, expect, it } from 'vitest';
import {
  applyVideoFormatExtension,
  getDefaultUpscalerForPlatform,
  getUpscaleFactor,
  getSupportedUpscaleModesForUpscaler,
  getSupportedUpscaleOptionsForUpscaler,
  getUpscalerSupportedScaleSummary,
  isUpscaleModeSupportedByUpscaler,
  getSupportedUpscalerOptions,
  imageFormatSupportsAlpha,
  getVideoFormatExtension,
  getVideoFormatLabel,
  normalizeUpscaleModeForUpscaler,
  UPSCALER_OPTIONS,
  IMAGE_FORMAT_OPTIONS,
  REAL_ESRGAN_MODEL_OPTIONS,
  UPSCALE_OPTIONS,
  VIDEO_FORMAT_OPTIONS,
  videoFormatSupportsAlpha,
  isValidRealEsrganModel,
} from './formats';

describe('shared format metadata', () => {
  it('includes the extended video format set', () => {
    expect(VIDEO_FORMAT_OPTIONS.map((option) => option.value)).toEqual(
      expect.arrayContaining(['mov-h264', 'mov-hevc', 'mkv-h264', 'mkv-hevc', 'prores4444', 'apng'])
    );
  });

  it('includes the extended image format set', () => {
    expect(IMAGE_FORMAT_OPTIONS.map((option) => option.value)).toEqual(
      expect.arrayContaining(['bmp', 'tiff', 'tga'])
    );
  });

  it('includes the supported upscale modes', () => {
    expect(UPSCALE_OPTIONS.map((option) => option.value)).toEqual([
      'off',
      '2x',
      '3x',
      '4x',
      '6x',
      '8x',
    ]);
    expect(UPSCALER_OPTIONS.map((option) => option.value)).toEqual([
      'realesrgan',
      'realcugan',
      'waifu2x',
      'realsr',
      'swinir',
      'dat',
      'anime4kcpp',
      'xbr-js',
      'pixel-scale-epx',
      'nearest',
    ]);
    expect(getUpscaleFactor('off')).toBe(1);
    expect(getUpscaleFactor('4x')).toBe(4);
    expect(getUpscaleFactor('8x')).toBe(8);
  });

  it('includes the supported Real-ESRGAN models', () => {
    expect(REAL_ESRGAN_MODEL_OPTIONS.map((option) => option.value)).toEqual([
      'realesrgan-x4plus',
      'realesrgan-x4plus-anime',
      'realesr-animevideov3',
    ]);
    expect(isValidRealEsrganModel('realesrgan-x4plus')).toBe(true);
    expect(isValidRealEsrganModel('invalid-model')).toBe(false);
  });

  it('reports supported scales per upscaler', () => {
    expect(getSupportedUpscaleModesForUpscaler('realesrgan')).toEqual([
      'off',
      '2x',
      '3x',
      '4x',
      '6x',
      '8x',
    ]);
    expect(getSupportedUpscaleModesForUpscaler('pixel-scale-epx')).toEqual([
      'off',
      '2x',
      '3x',
      '4x',
      '6x',
      '8x',
    ]);
    expect(getSupportedUpscaleOptionsForUpscaler('nearest').map((option) => option.value)).toEqual([
      'off',
      '2x',
      '3x',
      '4x',
      '6x',
      '8x',
    ]);
    expect(isUpscaleModeSupportedByUpscaler('dat', '6x')).toBe(true);
    expect(isUpscaleModeSupportedByUpscaler('pixel-scale-epx', '8x')).toBe(true);
    expect(isUpscaleModeSupportedByUpscaler('realesrgan', '8x')).toBe(true);
    expect(normalizeUpscaleModeForUpscaler('realesrgan', '8x')).toBe('8x');
    expect(normalizeUpscaleModeForUpscaler('pixel-scale-epx', '8x')).toBe('8x');
    expect(getUpscalerSupportedScaleSummary('realesrgan')).toBe('2x, 3x, 4x, 6x, 8x');
  });

  it('filters upscalers by platform support', () => {
    expect(getSupportedUpscalerOptions('win32').map((option) => option.value)).toEqual([
      'realesrgan',
      'realcugan',
      'waifu2x',
      'realsr',
      'swinir',
      'dat',
      'anime4kcpp',
      'xbr-js',
      'pixel-scale-epx',
      'nearest',
    ]);
    expect(getSupportedUpscalerOptions('darwin').map((option) => option.value)).toEqual([
      'realesrgan',
      'realcugan',
      'waifu2x',
      'realsr',
      'swinir',
      'dat',
      'xbr-js',
      'pixel-scale-epx',
      'nearest',
    ]);
    expect(getDefaultUpscalerForPlatform('linux')).toBe('realesrgan');
  });

  it('reports alpha-capable formats', () => {
    expect(videoFormatSupportsAlpha('apng')).toBe(true);
    expect(videoFormatSupportsAlpha('prores4444')).toBe(true);
    expect(videoFormatSupportsAlpha('mp4-h264')).toBe(false);
    expect(imageFormatSupportsAlpha('png')).toBe(true);
    expect(imageFormatSupportsAlpha('tga')).toBe(true);
    expect(imageFormatSupportsAlpha('jpg')).toBe(false);
  });

  it('maps new video formats to the expected extensions and labels', () => {
    expect(getVideoFormatExtension('mov-h264')).toBe('mov');
    expect(getVideoFormatExtension('mkv-hevc')).toBe('mkv');
    expect(getVideoFormatExtension('prores4444')).toBe('mov');
    expect(getVideoFormatExtension('apng')).toBe('apng');
    expect(getVideoFormatLabel('mov-hevc')).toBe('MOV (H.265 / HEVC)');
    expect(getVideoFormatLabel('prores4444')).toBe('ProRes 4444');
    expect(getVideoFormatLabel('apng')).toBe('APNG (animated PNG)');
  });

  it('normalizes chained output extensions to the selected format', () => {
    expect(applyVideoFormatExtension('render.apng.mp4', 'apng')).toBe('render.apng');
    expect(applyVideoFormatExtension('render.gif.webm', 'mp4-h264')).toBe('render.mp4');
  });
});
