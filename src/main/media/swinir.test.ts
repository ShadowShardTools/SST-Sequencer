import { describe, expect, it } from 'vitest';
import {
  isSwinIrMemoryRelatedErrorMessage,
  normalizeSwinIrRuntimeMode,
  shouldSwinIrPreferChopInference,
} from './swinir';

describe('SwinIR inference fallback helpers', () => {
  it('detects DirectML-style GPU memory allocation failures', () => {
    expect(
      isSwinIrMemoryRelatedErrorMessage(
        'RuntimeError: Could not allocate tensor with 1664090112 bytes. There is not enough GPU video memory available!'
      )
    ).toBe(true);
  });

  it('still detects generic out-of-memory failures', () => {
    expect(isSwinIrMemoryRelatedErrorMessage('CUDA out of memory while running inference')).toBe(
      true
    );
  });

  it('avoids false positives for non-memory errors', () => {
    expect(isSwinIrMemoryRelatedErrorMessage('Failed to decode image input.png')).toBe(false);
  });

  it('prefers chopped inference on DirectML devices', () => {
    expect(shouldSwinIrPreferChopInference('privateuseone')).toBe(true);
    expect(shouldSwinIrPreferChopInference('cuda')).toBe(false);
    expect(shouldSwinIrPreferChopInference('cpu')).toBe(false);
  });

  it('normalizes runtime mode with cpu-safe default', () => {
    expect(normalizeSwinIrRuntimeMode(undefined)).toBe('auto');
    expect(normalizeSwinIrRuntimeMode('cpu')).toBe('cpu');
    expect(normalizeSwinIrRuntimeMode('directml')).toBe('directml');
    expect(normalizeSwinIrRuntimeMode('bad-value')).toBe('auto');
  });
});
