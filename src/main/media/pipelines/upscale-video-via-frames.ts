import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { BackgroundRemoveModel } from '../../../shared/formats';
import {
  getUpscaleFactor,
  getUpscalerLabel,
  type AlphaMode,
  type UpscalerConfig,
} from '../../../shared/upscalers/registry';
import {
  createImagesFromImageSequence,
  createImagesFromVideo,
  type ResizeOptions,
} from '../ffmpeg';
import { getImageFilesFromFolder } from '../discovery';
import { probeMediaInfo } from '../ffprobe';
import type { JobEmitter } from '../types';
import {
  removeTemporaryDirectories,
  resolveUpscaledResize,
} from '../../jobs/job-helpers';
import { removeBackgroundFromImageDirectory } from './background-remove-directory';
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
  backgroundRemove: boolean;
  backgroundRemoveModel: BackgroundRemoveModel;
  emitter: JobEmitter;
  onExtractProgress?: (percent: number) => void;
}): Promise<void> {
  const upscaleFactor = getUpscaleFactor(
    options.upscaleMode as Parameters<typeof getUpscaleFactor>[0]
  );
  const sourceMediaInfo = await probeMediaInfo(options.videoPath);
  const preserveAlpha = options.backgroundRemove || Boolean(sourceMediaInfo.hasAlpha);

  if (upscaleFactor <= 1 && !options.backgroundRemove) {
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

  const tempBaseDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-base-'));
  let tempBackgroundRemovedDir = '';
  let tempUpscaledDir = '';

  try {
    options.emitter.log(
      `Extracting base frames from ${basename(options.videoPath)} for ${
        options.backgroundRemove ? 'background removal and ' : ''
      }${options.upscaleMode} ${getUpscalerLabel(options.upscalerConfig.kind)} processing.`
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

    let preparedInputDir = tempBaseDir;
    if (options.backgroundRemove) {
      tempBackgroundRemovedDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-bg-remove-'));
      await removeBackgroundFromImageDirectory({
        inputDir: tempBaseDir,
        outputDir: tempBackgroundRemovedDir,
        model: options.backgroundRemoveModel,
        emitter: options.emitter,
        logLabel: basename(options.videoPath),
      });
      preparedInputDir = tempBackgroundRemovedDir;
    }

    const preparedImagePaths = await getImageFilesFromFolder(preparedInputDir);
    if (upscaleFactor <= 1) {
      await createImagesFromImageSequence({
        imagePaths: preparedImagePaths,
        outputDir: options.outputDir,
        format: options.format,
        quality: options.quality,
        prefix: options.prefix,
        startNumber: options.startNumber,
        emitter: options.emitter,
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

      await createImagesFromImageSequence({
        imagePaths: preparedImagePaths,
        outputDir: options.outputDir,
        format: options.format,
        quality: options.quality,
        prefix: options.prefix,
        startNumber: options.startNumber,
        resize: nearestResize ? { ...nearestResize, flags: 'neighbor' } : nearestResize,
        emitter: options.emitter,
      });
      return;
    }

    tempUpscaledDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-out-'));
    options.emitter.log(
      `Running ${getUpscalerLabel(options.upscalerConfig.kind)} ${
        options.upscaleMode
      } on extracted frames from ${basename(options.videoPath)}.`
    );
    await upscaleFrameDirectory({
      upscalerConfig: options.upscalerConfig,
      inputDir: preparedInputDir,
      outputDir: tempUpscaledDir,
      scale: upscaleFactor,
      preserveAlpha,
      alphaMode: options.alphaMode,
      emitter: options.emitter,
    });

    const upscaledImagePaths = await getImageFilesFromFolder(tempUpscaledDir);
    if (upscaledImagePaths.length === 0) {
      throw new Error(
        `${getUpscalerLabel(options.upscalerConfig.kind)} did not produce any output frames.`
      );
    }
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
    await removeTemporaryDirectories(
      ...[tempBaseDir, tempBackgroundRemovedDir, tempUpscaledDir].filter(Boolean)
    );
  }
}

export async function extractVideoFramesForVideoUpscale(options: {
  videoPath: string;
  sourceFps: number;
  resize?: ResizeOptions;
  upscaleMode: string;
  upscalerConfig: UpscalerConfig;
  alphaMode: AlphaMode;
  backgroundRemove: boolean;
  backgroundRemoveModel: BackgroundRemoveModel;
  emitter: JobEmitter;
  onExtractProgress?: (percent: number) => void;
}): Promise<{ imagePaths: string[]; cleanup: () => Promise<void> }> {
  const sourceMediaInfo = await probeMediaInfo(options.videoPath);
  const preserveAlpha = options.backgroundRemove || Boolean(sourceMediaInfo.hasAlpha);
  const upscaleFactor = getUpscaleFactor(
    options.upscaleMode as Parameters<typeof getUpscaleFactor>[0]
  );
  const tempBaseDir = await mkdtemp(join(tmpdir(), 'sst-video-upscale-base-'));
  let tempBackgroundRemovedDir = '';
  let tempUpscaledDir = '';
  let tempNearestDir = '';

  try {
    if (!options.backgroundRemove && (upscaleFactor <= 1 || options.upscalerConfig.kind === 'nearest')) {
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
              ? {
                  ...directResize,
                  flags: options.upscalerConfig.kind === 'nearest' ? 'neighbor' : 'lanczos',
                }
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
          await removeTemporaryDirectories(...[tempBaseDir].filter(Boolean));
        },
      };
    }

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

    let preparedInputDir = tempBaseDir;
    if (options.backgroundRemove) {
      tempBackgroundRemovedDir = await mkdtemp(join(tmpdir(), 'sst-video-upscale-bg-remove-'));
      await removeBackgroundFromImageDirectory({
        inputDir: tempBaseDir,
        outputDir: tempBackgroundRemovedDir,
        model: options.backgroundRemoveModel,
        emitter: options.emitter,
        logLabel: basename(options.videoPath),
      });
      preparedInputDir = tempBackgroundRemovedDir;
    }

    const preparedImagePaths = await getImageFilesFromFolder(preparedInputDir);
    if (upscaleFactor <= 1) {
      return {
        imagePaths: preparedImagePaths,
        cleanup: async () => {
          await removeTemporaryDirectories(
            ...[tempBaseDir, tempBackgroundRemovedDir].filter(Boolean)
          );
        },
      };
    }

    if (options.upscalerConfig.kind === 'nearest') {
      const nearestResize = resolveUpscaledResize(
        options.resize,
        sourceMediaInfo.width,
        sourceMediaInfo.height,
        upscaleFactor
      );
      tempNearestDir = await mkdtemp(join(tmpdir(), 'sst-video-upscale-nearest-'));
      await createImagesFromImageSequence({
        imagePaths: preparedImagePaths,
        outputDir: tempNearestDir,
        format: 'png',
        quality: 100,
        prefix: 'frame',
        startNumber: 1,
        resize: nearestResize ? { ...nearestResize, flags: 'neighbor' } : nearestResize,
        emitter: options.emitter,
      });
      const imagePaths = await getImageFilesFromFolder(tempNearestDir);
      return {
        imagePaths,
        cleanup: async () => {
          await removeTemporaryDirectories(
            ...[tempBaseDir, tempBackgroundRemovedDir, tempNearestDir].filter(Boolean)
          );
        },
      };
    }

    tempUpscaledDir = await mkdtemp(join(tmpdir(), 'sst-video-upscale-out-'));
    await upscaleFrameDirectory({
      upscalerConfig: options.upscalerConfig,
      inputDir: preparedInputDir,
      outputDir: tempUpscaledDir,
      scale: upscaleFactor,
      preserveAlpha,
      alphaMode: options.alphaMode,
      emitter: options.emitter,
    });

    const imagePaths = await getImageFilesFromFolder(tempUpscaledDir);
    if (imagePaths.length === 0) {
      throw new Error(
        `${getUpscalerLabel(options.upscalerConfig.kind)} did not produce any output frames.`
      );
    }
    return {
      imagePaths,
      cleanup: async () => {
        await removeTemporaryDirectories(
          ...[tempBaseDir, tempBackgroundRemovedDir, tempUpscaledDir].filter(Boolean)
        );
      },
    };
  } catch (error) {
    await removeTemporaryDirectories(
      ...[tempBaseDir, tempBackgroundRemovedDir, tempUpscaledDir, tempNearestDir].filter(Boolean)
    );
    throw error;
  }
}
