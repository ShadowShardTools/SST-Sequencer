import { describe, expect, it } from 'vitest';
import {
  applyVideoFormatExtension,
  getVideoFormatExtension,
  getVideoFormatLabel,
  IMAGE_FORMAT_OPTIONS,
  VIDEO_FORMAT_OPTIONS,
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
