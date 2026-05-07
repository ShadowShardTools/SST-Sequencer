import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { getUpscaleFactor, getUpscalerLabel, type AlphaMode, type UpscalerConfig } from '../../../shared/upscalers/registry';
import { createImagesFromImageSequence, createImagesFromVideo, type ResizeOptions } from '../ffmpeg';
import { probeMediaInfo } from '../ffprobe';
import { getImageFilesFromFolder } from '../discovery';
import type { JobEmitter } from '../types';
import { removeTemporaryDirectories, resolveUpscaledResize } from '../../jobs/job-helpers';
import { upscaleFrameDirectory } from './upscale-frame-directory';

export async function createImageSequenceFromVideoWithUpscale(options: {
  videoPath: string;
  outputDir: string;
  fps: number;
  speed: number;
  quality: number;
  resize?: ResizeOptions;
  format: Parameters<typeof createImagesFromVideo>[0]['format'];
  prefix: string;
  startNumber: number;
  upscaleMode: string;
  upscalerConfig: UpscalerConfig;
  alphaMode: AlphaMode;
  emitter: JobEmitter;
  onExtractProgress?: (percent: number) => void;
}): Promise<void> {
  const upscaleFactor = getUpscaleFactor(options.upscaleMode as Parameters<typeof getUpscaleFactor>[0]);
  const sourceMediaInfo = await probeMediaInfo(options.videoPath);
  const preserveAlpha = Boolean(sourceMediaInfo.hasAlpha);

  if (upscaleFactor <= 1) {
    await createImagesFromVideo({
      videoPath: options.videoPath,
      outputDir: options.outputDir,
      fps: options.fps,
      speed: options.speed,
      quality: options.quality,
      resize: options.resize,
      format: options.format,
      prefix: options.prefix,
      startNumber: options.startNumber,
      emitter: options.emitter,
      onProgress: options.onExtractProgress,
    });
    return;
  }

  if (options.upscalerConfig.kind === 'nearest') {
    const nearestResize = resolveUpscaledResize(
      options.resize,
      sourceMediaInfo.width,
      sourceMediaInfo.height,
      upscaleFactor
    );

    await createImagesFromVideo({
      videoPath: options.videoPath,
      outputDir: options.outputDir,
      fps: options.fps,
      speed: options.speed,
      quality: options.quality,
      resize: nearestResize ? { ...nearestResize, flags: 'neighbor' } : nearestResize,
      format: options.format,
      prefix: options.prefix,
      startNumber: options.startNumber,
      emitter: options.emitter,
      onProgress: options.onExtractProgress,
    });
    return;
  }

  const tempBaseDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-base-'));
  const tempUpscaledDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-out-'));

  try {
    options.emitter.log(
      `Extracting base frames from ${basename(options.videoPath)} for ${options.upscaleMode} ${getUpscalerLabel(options.upscalerConfig.kind)} upscale.`
    );
    await createImagesFromVideo({
      videoPath: options.videoPath,
      outputDir: tempBaseDir,
      fps: options.fps,
      speed: options.speed,
      quality: 100,
      resize: options.resize,
      format: 'png',
      prefix: 'frame',
      startNumber: 1,
      emitter: options.emitter,
      onProgress: options.onExtractProgress,
    });

    options.emitter.log(
      `Running ${getUpscalerLabel(options.upscalerConfig.kind)} ${options.upscaleMode} on extracted frames from ${basename(options.videoPath)}.`
    );
    await upscaleFrameDirectory({
      upscalerConfig: options.upscalerConfig,
      inputDir: tempBaseDir,
      outputDir: tempUpscaledDir,
      scale: upscaleFactor,
      preserveAlpha,
      alphaMode: options.alphaMode,
      emitter: options.emitter,
    });

    const upscaledImagePaths = await getImageFilesFromFolder(tempUpscaledDir);
    await createImagesFromImageSequence({
      imagePaths: upscaledImagePaths,
      outputDir: options.outputDir,
      format: options.format,
      quality: options.quality,
      prefix: options.prefix,
      startNumber: options.startNumber,
      emitter: options.emitter,
    });
  } finally {
    await removeTemporaryDirectories(tempBaseDir, tempUpscaledDir);
  }
}

export async function extractVideoFramesForVideoUpscale(options: {
  videoPath: string;
  sourceFps: number;
  resize?: ResizeOptions;
  upscaleMode: string;
  upscalerConfig: UpscalerConfig;
  alphaMode: AlphaMode;
  emitter: JobEmitter;
  onExtractProgress?: (percent: number) => void;
}): Promise<{ imagePaths: string[]; cleanup: () => Promise<void> }> {
  const sourceMediaInfo = await probeMediaInfo(options.videoPath);
  const preserveAlpha = Boolean(sourceMediaInfo.hasAlpha);
  const upscaleFactor = getUpscaleFactor(options.upscaleMode as Parameters<typeof getUpscaleFactor>[0]);
  const tempBaseDir = await mkdtemp(join(tmpdir(), 'sst-video-upscale-base-'));
  let tempUpscaledDir = '';

  try {
    if (upscaleFactor <= 1 || options.upscalerConfig.kind === 'nearest') {
      const directResize =
        upscaleFactor > 1
          ? resolveUpscaledResize(
              options.resize,
              sourceMediaInfo.width,
              sourceMediaInfo.height,
              upscaleFactor
            )
          : options.resize;

      await createImagesFromVideo({
        videoPath: options.videoPath,
        outputDir: tempBaseDir,
        fps: options.sourceFps,
        speed: 1,
        quality: 100,
        resize:
          upscaleFactor > 1
            ? directResize
              ? { ...directResize, flags: options.upscalerConfig.kind === 'nearest' ? 'neighbor' : 'lanczos' }
              : directResize
            : directResize,
        format: 'png',
        prefix: 'frame',
        startNumber: 1,
        emitter: options.emitter,
        onProgress: options.onExtractProgress,
      });

      const imagePaths = await getImageFilesFromFolder(tempBaseDir);
      return {
        imagePaths,
        cleanup: async () => {
          await removeTemporaryDirectories(tempBaseDir);
        },
      };
    }

    tempUpscaledDir = await mkdtemp(join(tmpdir(), 'sst-video-upscale-out-'));

    await createImagesFromVideo({
      videoPath: options.videoPath,
      outputDir: tempBaseDir,
      fps: options.sourceFps,
      speed: 1,
      quality: 100,
      resize: options.resize,
      format: 'png',
      prefix: 'frame',
      startNumber: 1,
      emitter: options.emitter,
      onProgress: options.onExtractProgress,
    });

    await upscaleFrameDirectory({
      upscalerConfig: options.upscalerConfig,
      inputDir: tempBaseDir,
      outputDir: tempUpscaledDir,
      scale: upscaleFactor,
      preserveAlpha,
      alphaMode: options.alphaMode,
      emitter: options.emitter,
    });

    const imagePaths = await getImageFilesFromFolder(tempUpscaledDir);
    return {
      imagePaths,
      cleanup: async () => {
        await removeTemporaryDirectories(tempBaseDir, tempUpscaledDir);
      },
    };
  } catch (error) {
    await removeTemporaryDirectories(tempBaseDir, tempUpscaledDir);
    throw error;
  }
}
