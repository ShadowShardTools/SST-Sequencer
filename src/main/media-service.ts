import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import {
  getUpscaleFactor,
  getUpscalerLabel,
  type AlphaMode,
  type UpscalerType,
} from '../shared/formats';
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
import {
  createImagesFromImageSequence,
  createImagesFromVideo,
  createVideoFromImages,
} from './media/ffmpeg';
import { probeMediaInfo } from './media/ffprobe';
import { upscaleImageDirectory as upscaleWithAnime4kcpp } from './media/anime4kcpp';
import { upscaleImageDirectory as upscaleWithDat } from './media/dat';
import { upscaleImageDirectory as upscaleWithPixelScaleEpx } from './media/pixel-scale-epx';
import { upscaleImageDirectory as upscaleWithRealcugan } from './media/realcugan';
import { upscaleImageDirectory as upscaleWithRealEsrgan } from './media/realesrgan';
import { upscaleImageDirectory as upscaleWithRealSr } from './media/realsr';
import { upscaleImageDirectory as upscaleWithSwinIr } from './media/swinir';
import { upscaleImageDirectory as upscaleWithWaifu2x } from './media/waifu2x';
import { upscaleImageDirectory as upscaleWithXbrJs } from './media/xbr-js';
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
  validateAlphaMode,
  validateUpscaleMode,
  validateUpscalerType,
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
  validateUpscalerType(request.upscaler);
  validateUpscaleMode(request.upscaleMode);
  validateAlphaMode(request.alphaMode);

  const sourceImagePaths = await resolveSequenceInput(request);
  if (sourceImagePaths.length === 0) {
    throw new Error('No images were found for the selected sequence.');
  }

  const resize = await resolveSequenceResizeTarget(request, sourceImagePaths, {
    enforceEven: true,
  });
  const outputPath = await resolveSingleSequenceOutput(request, sourceImagePaths);
  const upscaleFactor = getUpscaleFactor(request.upscaleMode);
  const sourceMediaInfo = await probeMediaInfo(sourceImagePaths[0]);
  const preserveAlpha = Boolean(sourceMediaInfo.hasAlpha);
  let workingImagePaths = sourceImagePaths;
  let workingResize:
    | {
        width: number;
        height: number;
        flags?: 'lanczos' | 'neighbor' | 'bilinear';
      }
    | undefined = resize;
  let tempBaseDir = '';
  let tempUpscaledDir = '';

  try {
    if (upscaleFactor > 1) {
      if (request.upscaler === 'nearest') {
        emitter.log(
          `Applying ${request.upscaleMode} ${getUpscalerLabel(request.upscaler)} upscale from the selected base resolution.`
        );
        const nearestResize = resolveUpscaledResize(
          resize,
          sourceMediaInfo.width,
          sourceMediaInfo.height,
          upscaleFactor
        );
        workingResize = nearestResize ? { ...nearestResize, flags: 'neighbor' } : nearestResize;
      } else {
        tempBaseDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-base-'));
        tempUpscaledDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-out-'));

        emitter.log(
          `Preparing frames for ${request.upscaleMode} ${getUpscalerLabel(request.upscaler)} upscale.`
        );
        await createImagesFromImageSequence({
          imagePaths: sourceImagePaths,
          outputDir: tempBaseDir,
          format: 'png',
          quality: 100,
          prefix: 'frame',
          startNumber: 1,
          resize,
          emitter,
        });

        emitter.log(
          `Running ${getUpscalerLabel(request.upscaler)} ${request.upscaleMode} on ${sourceImagePaths.length} frame(s).`
        );
        await upscaleDirectoryUsingSelectedUpscaler({
          upscaler: request.upscaler,
          inputDir: tempBaseDir,
          outputDir: tempUpscaledDir,
          scale: upscaleFactor,
          epxAntialias: request.epxAntialias,
          preserveAlpha,
          alphaMode: request.alphaMode,
          emitter,
        });

        workingImagePaths = await getImageFilesFromFolder(tempUpscaledDir);
        workingResize = undefined;
      }
    }

    emitter.log(`Encoding ${workingImagePaths.length} frames into ${basename(outputPath)}.`);

    await createVideoFromImages({
      imagePaths: workingImagePaths,
      outputPath,
      fps: request.fps,
      speed: request.speed,
      quality: request.quality,
      format: request.format,
      resize: workingResize,
      emitter,
      onProgress: (percent) =>
        emitter.progress(percent, `Encoding ${basename(outputPath)}`, {
          currentItem: basename(outputPath),
          overallIndex: 1,
          overallTotal: 1,
        }),
    });
  } finally {
    if (tempBaseDir) {
      await rm(tempBaseDir, { recursive: true, force: true });
    }
    if (tempUpscaledDir) {
      await rm(tempUpscaledDir, { recursive: true, force: true });
    }
  }

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
  validateUpscalerType(request.upscaler);
  validateUpscaleMode(request.upscaleMode);
  validateAlphaMode(request.alphaMode);

  const videoPath = request.videoPath?.trim();
  if (!videoPath) {
    throw new Error('Select a source video before running the job.');
  }

  const resize = await resolveVideoResizeTarget(request, videoPath);
  const outputDir = await resolveSingleSequenceDirectory(request);
  const upscaleFactor = getUpscaleFactor(request.upscaleMode);
  const sourceMediaInfo = await probeMediaInfo(videoPath);
  const preserveAlpha = Boolean(sourceMediaInfo.hasAlpha);
  let tempBaseDir = '';
  let tempUpscaledDir = '';

  try {
    if (upscaleFactor > 1) {
      if (request.upscaler === 'nearest') {
        const nearestResize = resolveUpscaledResize(
          resize,
          sourceMediaInfo.width,
          sourceMediaInfo.height,
          upscaleFactor
        );
        emitter.log(
          `Extracting frames from ${basename(videoPath)} with ${request.upscaleMode} ${getUpscalerLabel(request.upscaler)} upscale.`
        );
        await createImagesFromVideo({
          videoPath,
          outputDir,
          fps: request.fps,
          speed: request.speed,
          quality: request.quality,
          resize: nearestResize ? { ...nearestResize, flags: 'neighbor' } : nearestResize,
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
      } else {
        tempBaseDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-base-'));
        tempUpscaledDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-out-'));

        emitter.log(
          `Extracting base frames from ${basename(videoPath)} for ${request.upscaleMode} ${getUpscalerLabel(request.upscaler)} upscale.`
        );
        await createImagesFromVideo({
          videoPath,
          outputDir: tempBaseDir,
          fps: request.fps,
          speed: request.speed,
          quality: 100,
          resize,
          format: 'png',
          prefix: 'frame',
          startNumber: 1,
          emitter,
          onProgress: (percent) =>
            emitter.progress(percent * 0.45, `Extracting ${basename(videoPath)}`, {
              currentItem: basename(videoPath),
              overallIndex: 1,
              overallTotal: 1,
            }),
        });

        emitter.log(
          `Running ${getUpscalerLabel(request.upscaler)} ${request.upscaleMode} on extracted frames.`
        );
        await upscaleDirectoryUsingSelectedUpscaler({
          upscaler: request.upscaler,
          inputDir: tempBaseDir,
          outputDir: tempUpscaledDir,
          scale: upscaleFactor,
          epxAntialias: request.epxAntialias,
          preserveAlpha,
          alphaMode: request.alphaMode,
          emitter,
        });

        const upscaledImagePaths = await getImageFilesFromFolder(tempUpscaledDir);
        emitter.log(`Writing ${request.format.toUpperCase()} sequence to ${basename(outputDir)}.`);
        await createImagesFromImageSequence({
          imagePaths: upscaledImagePaths,
          outputDir,
          format: request.format,
          quality: request.quality,
          prefix: request.prefix,
          startNumber: request.startNumber,
          emitter,
        });
      }
    } else {
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
    }
  } finally {
    if (tempBaseDir) {
      await rm(tempBaseDir, { recursive: true, force: true });
    }
    if (tempUpscaledDir) {
      await rm(tempUpscaledDir, { recursive: true, force: true });
    }
  }

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
  validateResolutionSetting(request);
  validateUpscalerType(request.upscaler);
  validateUpscaleMode(request.upscaleMode);
  validateAlphaMode(request.alphaMode);
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
      const resize = await resolveVideoResizeTarget(request, videoPath);
      const upscaleFactor = getUpscaleFactor(request.upscaleMode);
      const sourceMediaInfo = await probeMediaInfo(videoPath);
      const preserveAlpha = Boolean(sourceMediaInfo.hasAlpha);
      let tempBaseDir = '';
      let tempUpscaledDir = '';
      emitter.log(`Starting ${label} (${currentIndex}/${videoPaths.length}).`);

      try {
        if (upscaleFactor > 1) {
          if (request.upscaler === 'nearest') {
            const nearestResize = resolveUpscaledResize(
              resize,
              sourceMediaInfo.width,
              sourceMediaInfo.height,
              upscaleFactor
            );

            await createImagesFromVideo({
              videoPath,
              outputDir,
              fps: extractionFps,
              speed: request.speed,
              quality: request.quality,
              resize: nearestResize ? { ...nearestResize, flags: 'neighbor' } : nearestResize,
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
          } else {
            tempBaseDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-base-'));
            tempUpscaledDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-out-'));

            emitter.log(
              `Extracting base frames from ${label} for ${request.upscaleMode} ${getUpscalerLabel(request.upscaler)} upscale.`
            );
            await createImagesFromVideo({
              videoPath,
              outputDir: tempBaseDir,
              fps: extractionFps,
              speed: request.speed,
              quality: 100,
              resize,
              format: 'png',
              prefix: 'frame',
              startNumber: 1,
              emitter,
              onProgress: (percent) =>
                emitter.progress(
                  scaleBatchPercent(currentIndex, videoPaths.length, percent * 0.45),
                  `Extracting ${label}`,
                  {
                    currentItem: label,
                    overallIndex: currentIndex,
                    overallTotal: videoPaths.length,
                  }
                ),
            });

            emitter.log(
              `Running ${getUpscalerLabel(request.upscaler)} ${request.upscaleMode} on extracted frames from ${label}.`
            );
            await upscaleDirectoryUsingSelectedUpscaler({
              upscaler: request.upscaler,
              inputDir: tempBaseDir,
              outputDir: tempUpscaledDir,
              scale: upscaleFactor,
              epxAntialias: request.epxAntialias,
              preserveAlpha,
              alphaMode: request.alphaMode,
              emitter,
            });

            const upscaledImagePaths = await getImageFilesFromFolder(tempUpscaledDir);
            await createImagesFromImageSequence({
              imagePaths: upscaledImagePaths,
              outputDir,
              format: request.format,
              quality: request.quality,
              prefix: request.prefix,
              startNumber: request.startNumber,
              emitter,
            });
          }
        } else {
          await createImagesFromVideo({
            videoPath,
            outputDir,
            fps: extractionFps,
            speed: request.speed,
            quality: request.quality,
            resize,
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
        }
      } finally {
        if (tempBaseDir) {
          await rm(tempBaseDir, { recursive: true, force: true });
        }
        if (tempUpscaledDir) {
          await rm(tempUpscaledDir, { recursive: true, force: true });
        }
      }

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
  validateResolutionSetting(request);
  validateUpscalerType(request.upscaler);
  validateUpscaleMode(request.upscaleMode);
  validateAlphaMode(request.alphaMode);

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
      const resize = await resolveSequenceResizeTarget(request, imagePaths, {
        enforceEven: true,
      });
      const upscaleFactor = getUpscaleFactor(request.upscaleMode);
      const sourceMediaInfo = await probeMediaInfo(imagePaths[0]);
      const preserveAlpha = Boolean(sourceMediaInfo.hasAlpha);
      let workingImagePaths = imagePaths;
      let workingResize:
        | {
            width: number;
            height: number;
            flags?: 'lanczos' | 'neighbor' | 'bilinear';
          }
        | undefined = resize;
      let tempBaseDir = '';
      let tempUpscaledDir = '';
      emitter.log(`Starting ${label} (${currentIndex}/${sequenceFolders.length}).`);

      try {
        if (upscaleFactor > 1) {
          if (request.upscaler === 'nearest') {
            const nearestResize = resolveUpscaledResize(
              resize,
              sourceMediaInfo.width,
              sourceMediaInfo.height,
              upscaleFactor
            );
            workingResize = nearestResize ? { ...nearestResize, flags: 'neighbor' } : nearestResize;
          } else {
            tempBaseDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-base-'));
            tempUpscaledDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-out-'));

            emitter.log(
              `Preparing frames from ${label} for ${request.upscaleMode} ${getUpscalerLabel(request.upscaler)} upscale.`
            );
            await createImagesFromImageSequence({
              imagePaths,
              outputDir: tempBaseDir,
              format: 'png',
              quality: 100,
              prefix: 'frame',
              startNumber: 1,
              resize,
              emitter,
            });

            emitter.log(
              `Running ${getUpscalerLabel(request.upscaler)} ${request.upscaleMode} on ${label}.`
            );
            await upscaleDirectoryUsingSelectedUpscaler({
              upscaler: request.upscaler,
              inputDir: tempBaseDir,
              outputDir: tempUpscaledDir,
              scale: upscaleFactor,
              epxAntialias: request.epxAntialias,
              preserveAlpha,
              alphaMode: request.alphaMode,
              emitter,
            });

            workingImagePaths = await getImageFilesFromFolder(tempUpscaledDir);
          }
        }

        await createVideoFromImages({
          imagePaths: workingImagePaths,
          outputPath,
          fps: request.fps,
          speed: request.speed,
          quality: request.quality,
          format: request.format,
          resize: workingResize,
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
      } finally {
        if (tempBaseDir) {
          await rm(tempBaseDir, { recursive: true, force: true });
        }
        if (tempUpscaledDir) {
          await rm(tempUpscaledDir, { recursive: true, force: true });
        }
      }

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

function resolveUpscaledResize(
  baseResize: { width: number; height: number } | undefined,
  sourceWidth: number | undefined,
  sourceHeight: number | undefined,
  upscaleFactor: number
): { width: number; height: number } | undefined {
  if (baseResize) {
    return {
      width: baseResize.width * upscaleFactor,
      height: baseResize.height * upscaleFactor,
    };
  }

  if (!sourceWidth || !sourceHeight) {
    return undefined;
  }

  return {
    width: sourceWidth * upscaleFactor,
    height: sourceHeight * upscaleFactor,
  };
}

async function upscaleDirectoryUsingSelectedUpscaler(options: {
  upscaler: UpscalerType;
  inputDir: string;
  outputDir: string;
  scale: number;
  epxAntialias?: boolean;
  preserveAlpha: boolean;
  alphaMode: AlphaMode;
  emitter: JobEmitter;
}): Promise<void> {
  switch (options.upscaler) {
    case 'anime4kcpp':
      await upscaleWithAnime4kcpp(options);
      return;
    case 'xbr-js':
      await upscaleWithXbrJs(options);
      return;
    case 'pixel-scale-epx':
      await upscaleWithPixelScaleEpx(options);
      return;
    case 'realcugan':
      await upscaleWithRealcugan(options);
      return;
    case 'waifu2x':
      await upscaleWithWaifu2x(options);
      return;
    case 'realsr':
      await upscaleWithRealSr(options);
      return;
    case 'swinir':
      await upscaleWithSwinIr(options);
      return;
    case 'dat':
      await upscaleWithDat(options);
      return;
    case 'realesrgan-anime-video':
      await upscaleWithRealEsrgan(options);
      return;
    default:
      throw new Error(`Unsupported upscaler: ${getUpscalerLabel(options.upscaler)}.`);
  }
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
