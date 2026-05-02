import { describe, expect, it } from 'vitest';
import {
  applyVideoFormatExtension,
  getDefaultUpscalerForPlatform,
  getUpscaleFactor,
  getSupportedUpscalerOptions,
  imageFormatSupportsAlpha,
  getVideoFormatExtension,
  getVideoFormatLabel,
  UPSCALER_OPTIONS,
  IMAGE_FORMAT_OPTIONS,
  UPSCALE_OPTIONS,
  VIDEO_FORMAT_OPTIONS,
  videoFormatSupportsAlpha,
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
    expect(UPSCALE_OPTIONS.map((option) => option.value)).toEqual(['off', '2x', '3x', '4x']);
    expect(UPSCALER_OPTIONS.map((option) => option.value)).toEqual([
      'realesrgan-anime-video',
      'realcugan',
      'waifu2x',
      'realsr',
      'swinir',
      'dat',
      'anime4kcpp',
      'nearest',
    ]);
    expect(getUpscaleFactor('off')).toBe(1);
    expect(getUpscaleFactor('4x')).toBe(4);
  });

  it('filters upscalers by platform support', () => {
    expect(getSupportedUpscalerOptions('win32').map((option) => option.value)).toEqual([
      'realesrgan-anime-video',
      'realcugan',
      'waifu2x',
      'realsr',
      'swinir',
      'dat',
      'anime4kcpp',
      'nearest',
    ]);
    expect(getSupportedUpscalerOptions('darwin').map((option) => option.value)).toEqual([
      'realesrgan-anime-video',
      'realcugan',
      'waifu2x',
      'realsr',
      'swinir',
      'dat',
      'nearest',
    ]);
    expect(getDefaultUpscalerForPlatform('linux')).toBe('realesrgan-anime-video');
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
