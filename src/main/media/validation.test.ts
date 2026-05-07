import { describe, expect, it } from 'vitest';
import {
  sanitizePrefix,
  validateAlphaMode,
  validateFpsSetting,
  validateQualitySetting,
  validateRateSettings,
  validateResolutionSetting,
  validateSpeedSetting,
  validateUpscaleMode,
  validateUpscalerPresetConfiguration,
  validateUpscalerType,
} from './validation';

describe('media validation helpers', () => {
  it('accepts valid rate settings', () => {
    expect(() => validateRateSettings(24, 1)).not.toThrow();
    expect(() => validateFpsSetting(120)).not.toThrow();
    expect(() => validateSpeedSetting(0.25)).not.toThrow();
  });

  it('rejects invalid numeric settings with workflow-facing errors', () => {
    expect(() => validateFpsSetting(0)).toThrow('FPS must stay between 1 and 120.');
    expect(() => validateSpeedSetting(9)).toThrow('Speed must stay between 0.25 and 8.');
    expect(() => validateQualitySetting(101)).toThrow('Quality must stay between 1 and 100.');
    expect(() =>
      validateResolutionSetting({
        resolutionMode: 'custom',
        customWidth: 1,
        customHeight: 1080,
      })
    ).toThrow('Custom resolution width and height must stay between 2 and 8192.');
  });

  it('rejects invalid upscale and alpha settings', () => {
    expect(() => validateUpscaleMode('9x' as never, 'realesrgan')).toThrow(
      'Upscale mode is invalid.'
    );
    expect(() => validateAlphaMode('broken' as never)).toThrow(
      'Alpha mode is invalid: Auto-detect.'
    );
  });

  it('rejects invalid upscaler type and invalid backend-specific config', () => {
    expect(() => validateUpscalerType('broken' as never)).toThrow('Upscaler is invalid.');
    expect(() =>
      validateUpscalerPresetConfiguration({
        kind: 'realcugan',
        variant: 'turbo',
      } as never)
    ).toThrow('Real-CUGAN variant is invalid.');
  });

  it('sanitizes reserved filename characters and falls back to frame', () => {
    expect(sanitizePrefix('  hero:walk?*  ')).toBe('hero-walk--');
    expect(sanitizePrefix(' \u0000 ')).toBe('-');
    expect(sanitizePrefix('   ')).toBe('frame');
  });
});
