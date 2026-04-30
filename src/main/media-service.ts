import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import type {
  BatchSequenceToVideoJob,
  BatchVideoToSequenceJob,
  JobEvent,
  JobFailure,
  JobRequest,
  JobResult,
  JobSummary,
  SequenceToVideoJob,
  VideoToSequenceJob,
} from '../shared/jobs';
import { createImagesFromVideo, createVideoFromImages } from './media/ffmpeg';
import { probeMediaInfo } from './media/ffprobe';
import { resolveSequenceResizeTarget, resolveVideoResizeTarget } from './media/resize';
import {
  dedupeAndSort,
  discoverSequenceFolders,
  discoverVideoFiles,
  getImageFilesFromFolder,
} from './media/discovery';
import {
  resolveBatchSequenceDirectory,
  resolveBatchVideoOutput,
  resolveSequenceInput,
  resolveSingleSequenceDirectory,
  resolveSingleSequenceOutput,
} from './media/outputs';
import type { JobEmitter } from './media/types';
import {
  validateFpsSetting,
  validateQualitySetting,
  validateRateSettings,
  validateResolutionSetting,
  validateSpeedSetting,
} from './media/validation';

export {
  generateSequencePreview,
  inspectSequenceSource,
  inspectVideoSource,
} from './media/previews';

const JOB_EVENT_CHANNEL = 'jobs:event';

export async function runMediaJob(
  sender: Electron.WebContents,
  request: JobRequest
): Promise<JobResult> {
  const jobId = randomUUID();
  const emitter = createEmitter(sender, jobId);
  emitter.started(getStartMessage(request));

  try {
    const summary = await executeJob(request, emitter);
    const success = summary.failed === 0;
    emitter.finished(success, summary.headline, summary);

    return {
      jobId,
      success,
      summary,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    const summary: JobSummary = {
      headline: message,
      outputs: [],
      completed: 0,
      failed: 1,
      failures: [
        {
          source: getFailureSource(request),
          reason: message,
        },
      ],
    };

    emitter.log(message, 'error');
    emitter.finished(false, message, summary);

    return {
      jobId,
      success: false,
      summary,
    };
  }
}

async function executeJob(request: JobRequest, emitter: JobEmitter): Promise<JobSummary> {
  switch (request.kind) {
    case 'sequence-to-video':
      return runSequenceToVideoJob(request, emitter);
    case 'video-to-sequence':
      return runVideoToSequenceJob(request, emitter);
    case 'batch-video-to-sequence':
      return runBatchVideoToSequenceJob(request, emitter);
    case 'batch-sequence-to-video':
      return runBatchSequenceToVideoJob(request, emitter);
    default:
      throw new Error('Unsupported job type.');
  }
}

async function runSequenceToVideoJob(
  request: SequenceToVideoJob,
  emitter: JobEmitter
): Promise<JobSummary> {
  validateRateSettings(request.fps, request.speed);
  validateQualitySetting(request.quality);
  validateResolutionSetting(request);

  const imagePaths = await resolveSequenceInput(request);
  if (imagePaths.length === 0) {
    throw new Error('No images were found for the selected sequence.');
  }

  const resize = await resolveSequenceResizeTarget(request, imagePaths, {
    enforceEven: true,
  });
  const outputPath = await resolveSingleSequenceOutput(request, imagePaths);
  emitter.log(`Encoding ${imagePaths.length} frames into ${basename(outputPath)}.`);

  await createVideoFromImages({
    imagePaths,
    outputPath,
    fps: request.fps,
    speed: request.speed,
    quality: request.quality,
    format: request.format,
    resize,
    emitter,
    onProgress: (percent) =>
      emitter.progress(percent, `Encoding ${basename(outputPath)}`, {
        currentItem: basename(outputPath),
        overallIndex: 1,
        overallTotal: 1,
      }),
  });

  return {
    headline: `Created video: ${outputPath}`,
    outputs: [outputPath],
    completed: 1,
    failed: 0,
    failures: [],
  };
}

async function runVideoToSequenceJob(
  request: VideoToSequenceJob,
  emitter: JobEmitter
): Promise<JobSummary> {
  validateRateSettings(request.fps, request.speed);
  validateQualitySetting(request.quality);
  validateResolutionSetting(request);

  const videoPath = request.videoPath?.trim();
  if (!videoPath) {
    throw new Error('Select a source video before running the job.');
  }

  const resize = await resolveVideoResizeTarget(request, videoPath);
  const outputDir = await resolveSingleSequenceDirectory(request);
  emitter.log(`Extracting frames from ${basename(videoPath)}.`);

  await createImagesFromVideo({
    videoPath,
    outputDir,
    fps: request.fps,
    speed: request.speed,
    quality: request.quality,
    resize,
    format: request.format,
    prefix: request.prefix,
    startNumber: request.startNumber,
    emitter,
    onProgress: (percent) =>
      emitter.progress(percent, `Extracting ${basename(videoPath)}`, {
        currentItem: basename(videoPath),
        overallIndex: 1,
        overallTotal: 1,
      }),
  });

  return {
    headline: `Created image sequence: ${outputDir}`,
    outputs: [outputDir],
    completed: 1,
    failed: 0,
    failures: [],
  };
}

async function runBatchVideoToSequenceJob(
  request: BatchVideoToSequenceJob,
  emitter: JobEmitter
): Promise<JobSummary> {
  validateSpeedSetting(request.speed);
  validateQualitySetting(request.quality);
  if (request.overrideFps) {
    validateFpsSetting(request.fps);
  }

  const videoPaths =
    request.sourceMode === 'files'
      ? dedupeAndSort(request.videoPaths ?? [])
      : await discoverVideoFiles(request.scanRoot, request.recursive);

  if (videoPaths.length === 0) {
    throw new Error('No video files were found for the batch job.');
  }

  const outputs: string[] = [];
  const failures: JobFailure[] = [];

  emitter.log(`Discovered ${videoPaths.length} video file(s) for batch extraction.`);

  for (const [index, videoPath] of videoPaths.entries()) {
    const currentIndex = index + 1;
    const label = basename(videoPath);

    try {
      const outputDir = await resolveBatchSequenceDirectory(request, videoPath);
      const extractionFps = request.overrideFps
        ? request.fps
        : await resolveBatchVideoSourceFps(videoPath, request.fps, emitter);
      emitter.log(`Starting ${label} (${currentIndex}/${videoPaths.length}).`);

      await createImagesFromVideo({
        videoPath,
        outputDir,
        fps: extractionFps,
        speed: request.speed,
        quality: request.quality,
        format: request.format,
        prefix: request.prefix,
        startNumber: request.startNumber,
        emitter,
        onProgress: (percent) =>
          emitter.progress(
            scaleBatchPercent(currentIndex, videoPaths.length, percent),
            `Extracting ${label}`,
            {
              currentItem: label,
              overallIndex: currentIndex,
              overallTotal: videoPaths.length,
            }
          ),
      });

      outputs.push(outputDir);
    } catch (error) {
      const reason = getErrorMessage(error);
      failures.push({
        source: videoPath,
        reason,
      });
      emitter.log(`Failed ${label}: ${reason}`, 'error');
    }
  }

  return buildBatchSummary(
    outputs,
    failures,
    'Batch video-to-sequence finished',
    'No video sequences were created.'
  );
}

async function runBatchSequenceToVideoJob(
  request: BatchSequenceToVideoJob,
  emitter: JobEmitter
): Promise<JobSummary> {
  validateRateSettings(request.fps, request.speed);
  validateQualitySetting(request.quality);

  const sequenceFolders =
    request.sourceMode === 'folders'
      ? dedupeAndSort(request.sequenceFolders ?? [])
      : await discoverSequenceFolders(request.scanRoot, request.recursive);

  if (sequenceFolders.length === 0) {
    throw new Error('No image sequence folders were found for the batch job.');
  }

  const outputs: string[] = [];
  const failures: JobFailure[] = [];

  emitter.log(`Discovered ${sequenceFolders.length} sequence folder(s) for batch encoding.`);

  for (const [index, sequenceFolder] of sequenceFolders.entries()) {
    const currentIndex = index + 1;
    const label = basename(sequenceFolder);

    try {
      const imagePaths = await getImageFilesFromFolder(sequenceFolder);
      if (imagePaths.length === 0) {
        throw new Error('No supported image files were found in the sequence folder.');
      }

      const outputPath = await resolveBatchVideoOutput(request, sequenceFolder);
      emitter.log(`Starting ${label} (${currentIndex}/${sequenceFolders.length}).`);

      await createVideoFromImages({
        imagePaths,
        outputPath,
        fps: request.fps,
        speed: request.speed,
        quality: request.quality,
        format: request.format,
        emitter,
        onProgress: (percent) =>
          emitter.progress(
            scaleBatchPercent(currentIndex, sequenceFolders.length, percent),
            `Encoding ${label}`,
            {
              currentItem: label,
              overallIndex: currentIndex,
              overallTotal: sequenceFolders.length,
            }
          ),
      });

      outputs.push(outputPath);
    } catch (error) {
      const reason = getErrorMessage(error);
      failures.push({
        source: sequenceFolder,
        reason,
      });
      emitter.log(`Failed ${label}: ${reason}`, 'error');
    }
  }

  return buildBatchSummary(
    outputs,
    failures,
    'Batch sequence-to-video finished',
    'No videos were created from the selected sequences.'
  );
}

function createEmitter(sender: Electron.WebContents, jobId: string): JobEmitter {
  return {
    started: (message) => sendJobEvent(sender, { jobId, kind: 'started', message }),
    log: (message, level = 'info') => sendJobEvent(sender, { jobId, kind: 'log', level, message }),
    progress: (percent, message, meta) =>
      sendJobEvent(sender, {
        jobId,
        kind: 'progress',
        percent: clamp(percent, 0, 100),
        message,
        currentItem: meta?.currentItem,
        overallIndex: meta?.overallIndex,
        overallTotal: meta?.overallTotal,
      }),
    finished: (success, message, summary) =>
      sendJobEvent(sender, {
        jobId,
        kind: 'finished',
        success,
        message,
        summary,
      }),
  };
}

function sendJobEvent(sender: Electron.WebContents, event: JobEvent): void {
  if (!sender.isDestroyed()) {
    sender.send(JOB_EVENT_CHANNEL, event);
  }
}

function buildBatchSummary(
  outputs: string[],
  failures: JobFailure[],
  successHeadline: string,
  emptyHeadline: string
): JobSummary {
  if (outputs.length === 0) {
    return {
      headline: failures.length > 0 ? emptyHeadline : successHeadline,
      outputs,
      completed: 0,
      failed: failures.length,
      failures,
    };
  }

  return {
    headline: `${successHeadline}. Completed ${outputs.length}, failed ${failures.length}.`,
    outputs,
    completed: outputs.length,
    failed: failures.length,
    failures,
  };
}

function scaleBatchPercent(index: number, total: number, itemPercent: number): number {
  return ((index - 1 + itemPercent / 100) / total) * 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function resolveBatchVideoSourceFps(
  videoPath: string,
  fallbackFps: number,
  emitter: JobEmitter
): Promise<number> {
  const safeFallbackFps =
    Number.isFinite(fallbackFps) && fallbackFps >= 1 && fallbackFps <= 120 ? fallbackFps : 24;

  try {
    const mediaInfo = await probeMediaInfo(videoPath);
    if (mediaInfo.frameRate && Number.isFinite(mediaInfo.frameRate) && mediaInfo.frameRate > 0) {
      return Math.round(mediaInfo.frameRate * 1000) / 1000;
    }
  } catch (error) {
    emitter.log(
      `Could not detect source FPS for ${basename(videoPath)}. Falling back to ${safeFallbackFps} fps: ${getErrorMessage(error)}`,
      'error'
    );
    return safeFallbackFps;
  }

  emitter.log(
    `Could not detect source FPS for ${basename(videoPath)}. Falling back to ${safeFallbackFps} fps.`,
    'error'
  );
  return safeFallbackFps;
}

function getStartMessage(request: JobRequest): string {
  switch (request.kind) {
    case 'sequence-to-video':
      return 'Starting image-sequence to video job.';
    case 'video-to-sequence':
      return 'Starting video to image-sequence job.';
    case 'batch-video-to-sequence':
      return 'Starting batch video to image-sequence job.';
    case 'batch-sequence-to-video':
      return 'Starting batch image-sequence to video job.';
    default:
      return 'Starting media job.';
  }
}

function getFailureSource(request: JobRequest): string {
  switch (request.kind) {
    case 'sequence-to-video':
      return request.sequenceFolder ?? request.imagePaths?.[0] ?? 'sequence-to-video';
    case 'video-to-sequence':
      return request.videoPath ?? 'video-to-sequence';
    case 'batch-video-to-sequence':
      return request.scanRoot ?? request.videoPaths?.[0] ?? 'batch-video-to-sequence';
    case 'batch-sequence-to-video':
      return request.scanRoot ?? request.sequenceFolders?.[0] ?? 'batch-sequence-to-video';
    default:
      return 'media-job';
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'The media operation failed for an unknown reason.';
}
