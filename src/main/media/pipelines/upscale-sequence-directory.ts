import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BackgroundRemoveModel } from '../../../shared/formats';
import { getUpscaleFactor, getUpscalerLabel, type AlphaMode, type UpscalerConfig } from '../../../shared/upscalers/registry';
import { createImagesFromImageSequence, type ResizeOptions } from '../ffmpeg';
import { probeMediaInfo } from '../ffprobe';
import { getImageFilesFromFolder } from '../discovery';
import type { JobEmitter } from '../types';
import { removeTemporaryDirectories, resolveUpscaledResize } from '../../jobs/job-helpers';
import { removeBackgroundFromImageDirectory } from './background-remove-directory';
import { upscaleFrameDirectory } from './upscale-frame-directory';

export type PreparedSequenceFrames = {
  imagePaths: string[];
  resize?: ResizeOptions;
  cleanup: () => Promise<void>;
};

export async function prepareSequenceFramesForOutput(options: {
  imagePaths: string[];
  resize?: ResizeOptions;
  upscaleMode: string;
  upscalerConfig: UpscalerConfig;
  alphaMode: AlphaMode;
  backgroundRemove: boolean;
  backgroundRemoveModel: BackgroundRemoveModel;
  emitter: JobEmitter;
  logLabel?: string;
}): Promise<PreparedSequenceFrames> {
  const upscaleFactor = getUpscaleFactor(options.upscaleMode as Parameters<typeof getUpscaleFactor>[0]);
  if (upscaleFactor <= 1 && !options.backgroundRemove) {
    return {
      imagePaths: options.imagePaths,
      resize: options.resize,
      cleanup: async () => {},
    };
  }

  const sourceMediaInfo = await probeMediaInfo(options.imagePaths[0]);
  const preserveAlpha = options.backgroundRemove || Boolean(sourceMediaInfo.hasAlpha);

  const tempBaseDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-base-'));
  let tempBackgroundRemovedDir = '';
  let tempUpscaledDir = '';
  const labelSuffix = options.logLabel ? ` from ${options.logLabel}` : '';

  try {
    options.emitter.log(
      `Preparing frames${labelSuffix} for ${options.upscaleMode} ${getUpscalerLabel(options.upscalerConfig.kind)} upscale.`
    );
    await createImagesFromImageSequence({
      imagePaths: options.imagePaths,
      outputDir: tempBaseDir,
      format: 'png',
      quality: 100,
      prefix: 'frame',
      startNumber: 1,
      resize: options.resize,
      emitter: options.emitter,
    });

    let preparedInputDir = tempBaseDir;
    if (options.backgroundRemove) {
      tempBackgroundRemovedDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-bg-remove-'));
      await removeBackgroundFromImageDirectory({
        inputDir: tempBaseDir,
        outputDir: tempBackgroundRemovedDir,
        model: options.backgroundRemoveModel,
        emitter: options.emitter,
        logLabel: options.logLabel,
      });
      preparedInputDir = tempBackgroundRemovedDir;
    }

    const preparedImagePaths = await getImageFilesFromFolder(preparedInputDir);
    if (upscaleFactor <= 1) {
      return {
        imagePaths: preparedImagePaths,
        resize: undefined,
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

      return {
        imagePaths: preparedImagePaths,
        resize: nearestResize ? { ...nearestResize, flags: 'neighbor' } : nearestResize,
        cleanup: async () => {
          await removeTemporaryDirectories(
            ...[tempBaseDir, tempBackgroundRemovedDir].filter(Boolean)
          );
        },
      };
    }

    tempUpscaledDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-out-'));
    options.emitter.log(
      `Running ${getUpscalerLabel(options.upscalerConfig.kind)} ${options.upscaleMode} on ${options.imagePaths.length} frame(s)${labelSuffix}.`
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

    const upscaledPaths = await getImageFilesFromFolder(tempUpscaledDir);
    if (upscaledPaths.length === 0) {
      throw new Error(
        `${getUpscalerLabel(options.upscalerConfig.kind)} did not produce any output frames.`
      );
    }
    return {
      imagePaths: upscaledPaths,
      resize: undefined,
      cleanup: async () => {
        await removeTemporaryDirectories(
          ...[tempBaseDir, tempBackgroundRemovedDir, tempUpscaledDir].filter(Boolean)
        );
      },
    };
  } catch (error) {
    await removeTemporaryDirectories(
      ...[tempBaseDir, tempBackgroundRemovedDir, tempUpscaledDir].filter(Boolean)
    );
    throw error;
  }
}
