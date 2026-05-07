import { describe, expect, it } from 'vitest';
import {
  createDefaultUpscalerConfig,
  getUpscalerConfigFields,
  getUpscalerConfigValidationError,
  getUpscalerNote,
  isValidUpscalerConfig,
  type UpscalerConfig,
} from './registry';

describe('upscaler registry', () => {
  it('returns isolated default configs for each call', () => {
    const first = createDefaultUpscalerConfig('realcugan') as Extract<
      UpscalerConfig,
      { kind: 'realcugan' }
    >;
    const second = createDefaultUpscalerConfig('realcugan') as Extract<
      UpscalerConfig,
      { kind: 'realcugan' }
    >;

    expect(first).toEqual({
      kind: 'realcugan',
      variant: 'no-denoise',
    });
    expect(second).toEqual({
      kind: 'realcugan',
      variant: 'no-denoise',
    });

    first.variant = 'denoise';

    expect(second.variant).toBe('no-denoise');
  });

  it('exposes config fields with neutral names', () => {
    expect(getUpscalerConfigFields('realcugan').map((field) => field.key)).toEqual(['variant']);
    expect(getUpscalerConfigFields('waifu2x').map((field) => field.key)).toEqual([
      'model',
      'noise',
    ]);
  });

  it('validates backend-specific config values through the shared registry', () => {
    const invalidRealcugan = {
      kind: 'realcugan',
      variant: 'turbo',
    } as unknown as UpscalerConfig;
    const invalidWaifu2x = {
      kind: 'waifu2x',
      model: 'photo',
      noise: '9',
    } as unknown as UpscalerConfig;

    expect(getUpscalerConfigValidationError(invalidRealcugan)).toBe(
      'Real-CUGAN variant is invalid.'
    );
    expect(getUpscalerConfigValidationError(invalidWaifu2x)).toBe(
      'Waifu2x denoise is invalid.'
    );
    expect(isValidUpscalerConfig(invalidRealcugan)).toBe(false);
    expect(isValidUpscalerConfig(invalidWaifu2x)).toBe(false);
  });

  it('accepts valid shared configs', () => {
    expect(
      isValidUpscalerConfig({
        kind: 'realesrgan',
        model: 'realesrgan-x4plus-anime',
      })
    ).toBe(true);
    expect(
      isValidUpscalerConfig({
        kind: 'realcugan',
        variant: 'conservative',
      })
    ).toBe(true);
    expect(
      isValidUpscalerConfig({
        kind: 'waifu2x',
        model: 'cunet',
        noise: '2',
      })
    ).toBe(true);
  });

  it('describes bundled Python upscalers without manual install instructions', () => {
    const swinirNote = getUpscalerNote('swinir', '2x');
    const datNote = getUpscalerNote('dat', '2x');

    expect(swinirNote).toContain('runs on CPU by default');
    expect(swinirNote).not.toContain('requires Python');
    expect(swinirNote).not.toContain('installed');
    expect(datNote).toContain('runs on CPU by default');
    expect(datNote).not.toContain('requires Python');
    expect(datNote).not.toContain('installed');
  });
});
