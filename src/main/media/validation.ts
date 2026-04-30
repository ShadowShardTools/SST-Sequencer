import { isValidFps, isValidSpeed } from '../../shared/formats';

export function validateRateSettings(fps: number, speed: number): void {
  if (!isValidFps(fps)) {
    throw new Error('FPS must stay between 1 and 120.');
  }

  if (!isValidSpeed(speed)) {
    throw new Error('Speed must stay between 0.25 and 8.');
  }
}

export function sanitizePrefix(prefix: string): string {
  // eslint-disable-next-line no-control-regex -- strip reserved filename characters and control bytes.
  const cleaned = prefix.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');
  return cleaned || 'frame';
}
