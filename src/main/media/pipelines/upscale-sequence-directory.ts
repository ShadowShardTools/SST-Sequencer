import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getUpscaleFactor, getUpscalerLabel, type AlphaMode, type UpscalerConfig } from '../../../shared/upscalers/registry';
import { createImagesFromImageSequence, type ResizeOptions } from '../ffmpeg';
import { probeMediaInfo } from '../ffprobe';
import { getImageFilesFromFolder } from '../discovery';
import type { JobEmitter } from '../types';
import { removeTemporaryDirectories, resolveUpscaledResize } from '../../jobs/job-helpers';
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
  emitter: JobEmitter;
  logLabel?: string;
}): Promise<PreparedSequenceFrames> {
  const upscaleFactor = getUpscaleFactor(options.upscaleMode as Parameters<typeof getUpscaleFactor>[0]);
  if (upscaleFactor <= 1) {
    return {
      imagePaths: options.imagePaths,
      resize: options.resize,
      cleanup: async () => {},
    };
  }

  const sourceMediaInfo = await probeMediaInfo(options.imagePaths[0]);
  const preserveAlpha = Boolean(sourceMediaInfo.hasAlpha);

  if (options.upscalerConfig.kind === 'nearest') {
    const nearestResize = resolveUpscaledResize(
      options.resize,
      sourceMediaInfo.width,
      sourceMediaInfo.height,
      upscaleFactor
    );

    return {
      imagePaths: options.imagePaths,
      resize: nearestResize ? { ...nearestResize, flags: 'neighbor' } : nearestResize,
      cleanup: async () => {},
    };
  }

  const tempBaseDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-base-'));
  const tempUpscaledDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-out-'));
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

    options.emitter.log(
      `Running ${getUpscalerLabel(options.upscalerConfig.kind)} ${options.upscaleMode} on ${options.imagePaths.length} frame(s)${labelSuffix}.`
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

    const upscaledPaths = await getImageFilesFromFolder(tempUpscaledDir);
    return {
      imagePaths: upscaledPaths,
      resize: undefined,
      cleanup: async () => {
        await removeTemporaryDirectories(tempBaseDir, tempUpscaledDir);
      },
    };
  } catch (error) {
    await removeTemporaryDirectories(tempBaseDir, tempUpscaledDir);
    throw error;
  }
}
