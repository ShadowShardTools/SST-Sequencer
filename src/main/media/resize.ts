import type { ResolutionSettings, ResolvedResolution } from '../../shared/resolution';
import { resolveResolution } from '../../shared/resolution';
import { probeMediaInfo } from './ffprobe';

export async function resolveSequenceResizeTarget(
  settings: ResolutionSettings,
  imagePaths: string[],
  options: {
    enforceEven?: boolean;
  } = {}
): Promise<ResolvedResolution | undefined> {
  if (settings.resolutionMode === 'source') {
    return undefined;
  }

  if (settings.resolutionMode === 'custom') {
    const resolution = resolveResolution(settings, {}, options);
    if (!resolution) {
      throw new Error('Custom resolution is incomplete.');
    }

    return resolution;
  }

  const firstFramePath = imagePaths[0];
  if (!firstFramePath) {
    return undefined;
  }

  const mediaInfo = await probeMediaInfo(firstFramePath);
  const resolution = resolveResolution(settings, mediaInfo, options);
  if (!resolution) {
    throw new Error('Could not detect the source sequence resolution for resizing.');
  }

  return resolution;
}

export async function resolveVideoResizeTarget(
  settings: ResolutionSettings,
  videoPath: string,
  options: {
    enforceEven?: boolean;
  } = {}
): Promise<ResolvedResolution | undefined> {
  if (settings.resolutionMode === 'source') {
    return undefined;
  }

  if (settings.resolutionMode === 'custom') {
    const resolution = resolveResolution(settings, {}, options);
    if (!resolution) {
      throw new Error('Custom resolution is incomplete.');
    }

    return resolution;
  }

  const mediaInfo = await probeMediaInfo(videoPath);
  const resolution = resolveResolution(settings, mediaInfo, options);
  if (!resolution) {
    throw new Error('Could not detect the source video resolution for resizing.');
  }

  return resolution;
}

export async function resolveImageResizeTarget(
  settings: ResolutionSettings,
  imagePath: string,
  options: {
    enforceEven?: boolean;
  } = {}
): Promise<ResolvedResolution | undefined> {
  if (settings.resolutionMode === 'source') {
    return undefined;
  }

  if (settings.resolutionMode === 'custom') {
    const resolution = resolveResolution(settings, {}, options);
    if (!resolution) {
      throw new Error('Custom resolution is incomplete.');
    }

    return resolution;
  }

  const mediaInfo = await probeMediaInfo(imagePath);
  const resolution = resolveResolution(settings, mediaInfo, options);
  if (!resolution) {
    throw new Error('Could not detect the source image resolution for resizing.');
  }

  return resolution;
}
