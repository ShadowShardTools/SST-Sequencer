import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getUpscalerBackendId,
  getUpscalerLabel,
  type AlphaMode,
  type UpscalerConfig,
  type UpscalerType,
} from '../../../shared/upscalers/registry';
import { upscaleImageDirectory as upscaleWithAnime4kcpp } from '../anime4kcpp';
import { upscaleImageDirectory as upscaleWithDat } from '../dat';
import { upscaleImageDirectory as upscaleWithPixelScaleEpx } from '../pixel-scale-epx';
import { upscaleImageDirectory as upscaleWithRealcugan } from '../realcugan';
import { upscaleImageDirectory as upscaleWithRealEsrgan } from '../realesrgan';
import { upscaleImageDirectory as upscaleWithRealSr } from '../realsr';
import { upscaleImageDirectory as upscaleWithSwinIr } from '../swinir';
import type { JobEmitter } from '../types';
import { upscaleImageDirectory as upscaleWithWaifu2x } from '../waifu2x';
import { upscaleImageDirectory as upscaleWithXbrJs } from '../xbr-js';

export type UpscaleFrameDirectoryOptions = {
  upscalerConfig: UpscalerConfig;
  inputDir: string;
  outputDir: string;
  scale: number;
  preserveAlpha: boolean;
  alphaMode: AlphaMode;
  emitter: JobEmitter;
};

export async function upscaleFrameDirectory(
  options: UpscaleFrameDirectoryOptions
): Promise<void> {
  const upscaler = options.upscalerConfig.kind;
  const composedPasses = getComposedUpscalePasses(upscaler, options.scale);
  if (composedPasses) {
    const tempDirs: string[] = [];
    let currentInputDir = options.inputDir;

    options.emitter.log(
      `Composing ${options.scale}x ${getUpscalerLabel(upscaler)} upscale using ${composedPasses
        .map((pass) => `${pass}x`)
        .join(' then ')} passes.`
    );

    try {
      for (let index = 0; index < composedPasses.length; index += 1) {
        const passScale = composedPasses[index];
        const isLastPass = index === composedPasses.length - 1;
        const outputDir = isLastPass
          ? options.outputDir
          : await mkdtemp(join(tmpdir(), 'sst-sequencer-upscale-pass-'));

        if (!isLastPass) {
          tempDirs.push(outputDir);
        }

        await runUpscaleFrameDirectoryPass({
          ...options,
          inputDir: currentInputDir,
          outputDir,
          scale: passScale,
        });

        currentInputDir = outputDir;
      }
    } finally {
      await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    }

    return;
  }

  await runUpscaleFrameDirectoryPass(options);
}

async function runUpscaleFrameDirectoryPass(options: UpscaleFrameDirectoryOptions): Promise<void> {
  switch (getUpscalerBackendId(options.upscalerConfig)) {
    case 'anime4kcpp': {
      const config = options.upscalerConfig as Extract<UpscalerConfig, { kind: 'anime4kcpp' }>;
      await upscaleWithAnime4kcpp({
        ...options,
        anime4kcppModel: config.model,
      });
      return;
    }
    case 'xbr-js':
      await upscaleWithXbrJs(options);
      return;
    case 'pixel-scale-epx':
      await upscaleWithPixelScaleEpx({
        ...options,
        epxAntialias: false,
      });
      return;
    case 'realcugan': {
      const config = options.upscalerConfig as Extract<UpscalerConfig, { kind: 'realcugan' }>;
      await upscaleWithRealcugan({
        ...options,
        realcuganVariant: config.variant,
      });
      return;
    }
    case 'waifu2x': {
      const config = options.upscalerConfig as Extract<UpscalerConfig, { kind: 'waifu2x' }>;
      await upscaleWithWaifu2x({
        ...options,
        waifu2xModel: config.model,
        waifu2xNoiseLevel: config.noise,
      });
      return;
    }
    case 'realsr':
      await upscaleWithRealSr(options);
      return;
    case 'swinir':
      await upscaleWithSwinIr(options);
      return;
    case 'dat':
      await upscaleWithDat(options);
      return;
    case 'realesrgan': {
      const config = options.upscalerConfig as Extract<UpscalerConfig, { kind: 'realesrgan' }>;
      await upscaleWithRealEsrgan({
        ...options,
        realEsrganModel: config.model,
      });
      return;
    }
    default:
      throw new Error(`Unsupported upscaler: ${getUpscalerLabel(options.upscalerConfig.kind)}.`);
  }
}

function getComposedUpscalePasses(upscaler: UpscalerType, scale: number): number[] | null {
  if (
    scale <= 4 ||
    upscaler === 'xbr-js' ||
    upscaler === 'pixel-scale-epx' ||
    upscaler === 'realesrgan'
  ) {
    return null;
  }

  if (scale === 6) {
    return [3, 2];
  }

  if (scale === 8) {
    return [4, 2];
  }

  return null;
}
