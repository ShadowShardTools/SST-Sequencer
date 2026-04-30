import { describe, expect, it } from 'vitest';
import {
  buildSuggestedVideoName,
  estimateVideoSizeNote,
  formatDuration,
  formatResolution,
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
  });

  it('formats duration and resolution values for UI display', () => {
    expect(formatDuration(1.46)).toBe('1.46s');
    expect(formatDuration(65)).toBe('1m 5s');
    expect(formatResolution(1920, 1080)).toBe('1920 x 1080');
  });

  it('estimates size only when preview and timing inputs are valid', () => {
    const note = estimateVideoSizeNote(
      {
        firstFramePath: 'C:\\shots\\plate_0001.png',
        frameCount: 240,
        width: 1920,
        height: 1080,
      },
      24,
      1,
      'mp4-h264'
    );

    expect(note).toContain('Estimated size: about');
    expect(estimateVideoSizeNote(null, 24, 1, 'mp4-h264')).toBeNull();
  });
});
