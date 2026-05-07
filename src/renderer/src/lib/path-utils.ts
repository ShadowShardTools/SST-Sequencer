import { applyVideoFormatExtension, getVideoFormatExtension, type VideoFormat } from '../../../shared/formats';

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export function getExtension(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() || '';
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : '';
}

export function getParentDirectory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash > 0 ? normalized.slice(0, lastSlash) : normalized;
}

export function basenameLabel(filePath: string): string {
  if (!filePath) {
    return '';
  }

  const normalized = filePath.replace(/\\/g, '/');
  return normalized.split('/').pop() || normalized;
}

export function toFileUrl(filePath: string): string {
  return `file://${filePath.replace(/\\/g, '/').replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
}

export function sortNaturalPaths(paths: string[]): string[] {
  return [...paths].sort((left, right) =>
    naturalCollator.compare(basenameLabel(left), basenameLabel(right))
  );
}

export function buildSuggestedVideoName(
  sourcePath: string | undefined,
  format: VideoFormat
): string {
  const sourceName = basenameLabel(sourcePath || 'sequence');
  const ext = getVideoFormatExtension(format);
  const suffixIndex = sourceName.lastIndexOf('.');
  const baseName = suffixIndex > 0 ? sourceName.slice(0, suffixIndex) : sourceName;
  return `${baseName}.${ext}`;
}

export function replacePathExtension(filePath: string, format: VideoFormat): string {
  return applyVideoFormatExtension(filePath, format);
}
