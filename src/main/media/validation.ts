import { isValidFps, isValidQuality, isValidSpeed } from '../../shared/formats';
import { isValidResolutionSettings, type ResolutionSettings } from '../../shared/resolution';

export function validateRateSettings(fps: number, speed: number): void {
  validateFpsSetting(fps);
  validateSpeedSetting(speed);
}

export function validateFpsSetting(fps: number): void {
  if (!isValidFps(fps)) {
    throw new Error('FPS must stay between 1 and 120.');
  }
}

export function validateSpeedSetting(speed: number): void {
  if (!isValidSpeed(speed)) {
    throw new Error('Speed must stay between 0.25 and 8.');
  }
}

export function validateQualitySetting(quality: number): void {
  if (!isValidQuality(quality)) {
    throw new Error('Quality must stay between 1 and 100.');
  }
}

export function validateResolutionSetting(settings: ResolutionSettings): void {
  if (!isValidResolutionSettings(settings)) {
    throw new Error('Custom resolution width and height must stay between 2 and 8192.');
  }
}

export function sanitizePrefix(prefix: string): string {
  // eslint-disable-next-line no-control-regex -- strip reserved filename characters and control bytes.
  const cleaned = prefix.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');
  return cleaned || 'frame';
}
