import { describe, expect, it } from 'vitest';
import { estimateAlphaModeFromRgba } from './ffmpeg';

describe('estimateAlphaModeFromRgba', () => {
  it('detects straight alpha when semi-transparent pixels keep bright RGB values', () => {
    const rgba = Buffer.from([
      255, 200, 120, 255, 255, 200, 120, 64, 255, 200, 120, 255, 255, 200, 120, 64,
    ]);

    expect(estimateAlphaModeFromRgba(rgba, 2, 2)).toBe('straight');
  });

  it('detects premultiplied alpha when semi-transparent RGB tracks alpha', () => {
    const rgba = Buffer.from([
      255, 200, 120, 255, 64, 50, 30, 64, 255, 200, 120, 255, 64, 50, 30, 64,
    ]);

    expect(estimateAlphaModeFromRgba(rgba, 2, 2)).toBe('premultiplied');
  });

  it('falls back to straight alpha when there are no semi-transparent samples', () => {
    const rgba = Buffer.from([255, 200, 120, 255, 0, 0, 0, 0, 255, 200, 120, 255, 0, 0, 0, 0]);

    expect(estimateAlphaModeFromRgba(rgba, 2, 2)).toBe('straight');
  });
});
