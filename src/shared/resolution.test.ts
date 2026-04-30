import { describe, expect, it } from 'vitest';
import { resolveResolution } from './resolution';

describe('shared resolution helpers', () => {
  it('resolves fractional and custom sizes predictably', () => {
    expect(resolveResolution({ resolutionMode: 'half' }, { width: 1920, height: 1080 })).toEqual({
      width: 960,
      height: 540,
    });

    expect(resolveResolution({ resolutionMode: 'quarter' }, { width: 2000, height: 1000 })).toEqual(
      {
        width: 500,
        height: 250,
      }
    );

    expect(resolveResolution({ resolutionMode: 'eighth' }, { width: 1920, height: 1080 })).toEqual(
      {
        width: 240,
        height: 135,
      }
    );

    expect(
      resolveResolution(
        { resolutionMode: 'custom', customWidth: 1001, customHeight: 777 },
        {},
        { enforceEven: true }
      )
    ).toEqual({
      width: 1000,
      height: 776,
    });
  });
});
