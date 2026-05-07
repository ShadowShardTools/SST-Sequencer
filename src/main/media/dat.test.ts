import { describe, expect, it } from 'vitest';
import {
  isDatMemoryRelatedErrorMessage,
  normalizeDatRuntimeMode,
  shouldDatPreferChopInference,
} from './dat';

describe('DAT inference fallback helpers', () => {
  it('detects DirectML-style GPU memory allocation failures', () => {
    expect(
      isDatMemoryRelatedErrorMessage(
        'RuntimeError: Could not allocate tensor with 1664090112 bytes. There is not enough GPU video memory available!'
      )
    ).toBe(true);
  });

  it('still detects generic out-of-memory failures', () => {
    expect(isDatMemoryRelatedErrorMessage('CUDA out of memory while running inference')).toBe(
      true
    );
  });

  it('avoids false positives for non-memory errors', () => {
    expect(isDatMemoryRelatedErrorMessage('Failed to decode image input.png')).toBe(false);
  });

  it('prefers chopped inference on DirectML devices', () => {
    expect(shouldDatPreferChopInference('privateuseone')).toBe(true);
    expect(shouldDatPreferChopInference('cuda')).toBe(false);
    expect(shouldDatPreferChopInference('cpu')).toBe(false);
  });

  it('normalizes runtime mode with cpu-safe default', () => {
    expect(normalizeDatRuntimeMode(undefined)).toBe('auto');
    expect(normalizeDatRuntimeMode('cpu')).toBe('cpu');
    expect(normalizeDatRuntimeMode('directml')).toBe('directml');
    expect(normalizeDatRuntimeMode('bad-value')).toBe('auto');
  });
});
