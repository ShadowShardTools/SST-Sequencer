import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SequenceInputMode } from '../../shared/formats';
import type { JobSummary } from '../../shared/jobs';
import type { SequenceSourcePreview, VideoSourcePreview } from '../../shared/previews';
import { createVideoFromImages } from './ffmpeg';
import { dedupeAndSort, getImageFilesFromFolder } from './discovery';
import { probeMediaInfo } from './ffprobe';
import type { JobEmitter } from './types';
import { validateRateSettings } from './validation';

const previewArtifactDirs: string[] = [];

const silentEmitter: JobEmitter = {
  started: () => undefined,
  log: () => undefined,
  progress: () => undefined,
  finished: (_success: boolean, _message: string, _summary: JobSummary) => undefined,
};

export async function inspectSequenceSource(input: {
  sourceMode: SequenceInputMode;
  sequenceFolder?: string;
  imagePaths?: string[];
}): Promise<SequenceSourcePreview | null> {
  const imagePaths =
    input.sourceMode === 'images'
      ? dedupeAndSort(input.imagePaths ?? [])
      : input.sequenceFolder?.trim()
        ? await getImageFilesFromFolder(input.sequenceFolder.trim())
        : [];

  if (imagePaths.length === 0) {
    return null;
  }

  const mediaInfo = await probeMediaInfo(imagePaths[0]);
  return {
    firstFramePath: imagePaths[0],
    frameCount: imagePaths.length,
    width: mediaInfo.width,
    height: mediaInfo.height,
  };
}

export async function inspectVideoSource(videoPath: string): Promise<VideoSourcePreview | null> {
  const sourcePath = videoPath.trim();
  if (!sourcePath) {
    return null;
  }

  const mediaInfo = await probeMediaInfo(sourcePath);
  return {
    videoPath: sourcePath,
    width: mediaInfo.width,
    height: mediaInfo.height,
    frameRate: mediaInfo.frameRate,
    durationSeconds: mediaInfo.durationSeconds,
  };
}

export async function generateSequencePreview(input: {
  sourceMode: SequenceInputMode;
  sequenceFolder?: string;
  imagePaths?: string[];
  fps: number;
  speed: number;
}): Promise<VideoSourcePreview | null> {
  validateRateSettings(input.fps, input.speed);

  const imagePaths =
    input.sourceMode === 'images'
      ? dedupeAndSort(input.imagePaths ?? [])
      : input.sequenceFolder?.trim()
        ? await getImageFilesFromFolder(input.sequenceFolder.trim())
        : [];

  if (imagePaths.length === 0) {
    return null;
  }

  const previewFrameLimit = Math.min(
    imagePaths.length,
    Math.max(24, Math.min(120, Math.round(input.fps * 3)))
  );
  const previewFrames = imagePaths.slice(0, previewFrameLimit);
  const previewDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-preview-'));
  const outputPath = join(previewDir, 'preview.webm');

  await prunePreviewArtifacts();
  previewArtifactDirs.push(previewDir);

  await createVideoFromImages({
    imagePaths: previewFrames,
    outputPath,
    fps: input.fps,
    speed: input.speed,
    format: 'webm-vp9',
    emitter: silentEmitter,
    extraVideoFilters: ['scale=trunc(iw*min(1\\,960/iw)/2)*2:trunc(ih*min(1\\,960/iw)/2)*2'],
  });

  return inspectVideoSource(outputPath);
}

async function prunePreviewArtifacts(): Promise<void> {
  while (previewArtifactDirs.length >= 4) {
    const targetDir = previewArtifactDirs.shift();
    if (!targetDir) {
      return;
    }

    await rm(targetDir, { recursive: true, force: true });
  }
}
