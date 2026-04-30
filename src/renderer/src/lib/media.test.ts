import { describe, expect, it } from 'vitest';
import {
  buildSuggestedVideoName,
  estimateVideoSizeNote,
  formatDuration,
  formatResolution,
  getImageAdjustmentUi,
  getImageQualityNote,
  getVideoQualityNote,
  isVideoPath,
  replacePathExtension,
  trimNumber,
} from './media';

describe('renderer media helpers', () => {
  it('formats decimal values without trailing zeros', () => {
    expect(trimNumber(24)).toBe('24');
    expect(trimNumber(0.5)).toBe('0.5');
    expect(trimNumber(1.25)).toBe('1.25');
  });

  it('builds a suggested video filename from the source path', () => {
    expect(buildSuggestedVideoName('C:\\shots\\plate_0001.png', 'mp4-h264')).toBe('plate_0001.mp4');
    expect(buildSuggestedVideoName('C:\\shots\\frames', 'webm-vp9')).toBe('frames.webm');
    expect(buildSuggestedVideoName('C:\\shots\\frames', 'apng')).toBe('frames.apng');
  });

  it('replaces an existing output extension when the format changes', () => {
    expect(replacePathExtension('C:\\shots\\render.mp4', 'apng')).toBe('C:\\shots\\render.apng');
    expect(replacePathExtension('C:\\shots\\render', 'webm-vp9')).toBe('C:\\shots\\render.webm');
  });

  it('treats animated GIF and APNG files as video-like inputs', () => {
    expect(isVideoPath('C:\\loops\\idle.gif')).toBe(true);
    expect(isVideoPath('C:\\loops\\idle.apng')).toBe(true);
  });

  it('formats duration and resolution values for UI display', () => {
    expect(formatDuration(1.46)).toBe('1.46s');
    expect(formatDuration(65)).toBe('1m 5s');
    expect(formatResolution(1920, 1080)).toBe('1920 x 1080');
  });

  it('estimates size only when preview and timing inputs are valid', () => {
    const highQualityNote = estimateVideoSizeNote(
      {
        firstFramePath: 'C:\\shots\\plate_0001.png',
        frameCount: 240,
        width: 1920,
        height: 1080,
      },
      24,
      1,
      'mp4-h264',
      100
    );
    const lowerQualityNote = estimateVideoSizeNote(
      {
        firstFramePath: 'C:\\shots\\plate_0001.png',
        frameCount: 240,
        width: 1920,
        height: 1080,
      },
      24,
      1,
      'mp4-h264',
      40
    );

    expect(highQualityNote).toContain('Estimated size: about');
    expect(highQualityNote).not.toBe(lowerQualityNote);
    expect(estimateVideoSizeNote(null, 24, 1, 'mp4-h264', 100)).toBeNull();
  });

  it('describes video quality differently per output format', () => {
    expect(getVideoQualityNote('mp4-h264', 100)).toContain('CRF 0');
    expect(getVideoQualityNote('webm-vp9', 50)).toContain('VP9 target');
    expect(getVideoQualityNote('apng', 75)).toContain('lossless');
    expect(getVideoQualityNote('gif-palette', 25)).toContain('colors');
  });

  it('describes image quality differently per output format', () => {
    expect(getImageQualityNote('jpg', 100)).toContain('JPEG target');
    expect(getImageQualityNote('webp', 60)).toContain('WebP target');
    expect(getImageQualityNote('png', 40)).toContain('lossless');
    expect(getImageQualityNote('bmp', 80)).toContain('uncompressed');
  });

  it('adapts the image adjustment control per output format', () => {
    expect(getImageAdjustmentUi('jpg', 80)).toMatchObject({
      label: 'Image quality',
      adjustable: true,
      valueLabel: '80%',
    });
    expect(getImageAdjustmentUi('png', 80)).toMatchObject({
      label: 'Compression',
      adjustable: true,
      minLabel: 'Smaller file',
      maxLabel: 'Faster encode',
    });
    expect(getImageAdjustmentUi('bmp', 80)).toMatchObject({
      label: 'Compression',
      adjustable: false,
    });
  });
});
