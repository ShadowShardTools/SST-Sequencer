import type { VideoSourcePreview } from '../../../shared/previews';
import { basenameLabel } from './path-utils';
import { trimNumber } from './numeric';

export function buildPreviewItems(paths: string[] | undefined, max = 4): string[] | undefined {
  if (!paths || paths.length === 0) {
    return undefined;
  }

  const labels = paths.slice(0, max).map((path) => basenameLabel(path));
  const remaining = paths.length - max;

  if (remaining > 0) {
    labels.push(`+${remaining} more`);
  }

  return labels;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${trimNumber(value)} ${units[exponent]}`;
}

export function formatResolution(width?: number, height?: number): string | null {
  if (!width || !height) {
    return null;
  }

  return `${width} x ${height}`;
}

export function getVideoAspectRatio(preview: VideoSourcePreview): string {
  if (!preview.width || !preview.height) {
    return '16 / 9';
  }

  return `${preview.width} / ${preview.height}`;
}

export function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0s';
  }

  if (value >= 60) {
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return `${minutes}m ${trimNumber(seconds)}s`;
  }

  return `${trimNumber(value)}s`;
}
