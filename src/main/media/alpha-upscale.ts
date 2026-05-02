import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AlphaMode } from '../../shared/formats';
import { getImageFilesFromFolder } from './discovery';
import {
  detectAlphaMode,
  extractImageColorAndAlpha,
  mergeImageAlpha,
  scaleStillImage,
  type ResolvedAlphaMode,
} from './ffmpeg';
import type { JobEmitter } from './types';

export async function upscaleImageDirectoryPreservingAlpha(options: {
  inputDir: string;
  outputDir: string;
  scale: number;
  alphaMode: AlphaMode;
  emitter: JobEmitter;
  alphaScaleFlags?: 'lanczos' | 'neighbor' | 'bilinear';
  upscaleOpaqueDirectory: (inputDir: string, outputDir: string) => Promise<void>;
}): Promise<void> {
  const inputImagePaths = await getImageFilesFromFolder(options.inputDir);
  if (inputImagePaths.length === 0) {
    return;
  }

  const tempRoot = await mkdtemp(join(tmpdir(), 'sst-alpha-upscale-'));
  const colorInputDir = join(tempRoot, 'color-in');
  const alphaInputDir = join(tempRoot, 'alpha-in');
  const colorOutputDir = join(tempRoot, 'color-out');
  const alphaOutputDir = join(tempRoot, 'alpha-out');

  try {
    await mkdir(colorInputDir, { recursive: true });
    await mkdir(alphaInputDir, { recursive: true });
    await mkdir(colorOutputDir, { recursive: true });
    await mkdir(alphaOutputDir, { recursive: true });

    const resolvedAlphaMode = await resolveWorkingAlphaMode(
      options.alphaMode,
      inputImagePaths[0],
      options.emitter
    );

    for (const [index, inputPath] of inputImagePaths.entries()) {
      const frameName = `frame_${String(index + 1).padStart(6, '0')}.png`;
      await extractImageColorAndAlpha({
        inputPath,
        colorOutputPath: join(colorInputDir, frameName),
        alphaOutputPath: join(alphaInputDir, frameName),
        alphaMode: resolvedAlphaMode,
        emitter: options.emitter,
      });
    }

    await options.upscaleOpaqueDirectory(colorInputDir, colorOutputDir);
    const colorOutputPaths = await getImageFilesFromFolder(colorOutputDir);
    const alphaInputPaths = await getImageFilesFromFolder(alphaInputDir);

    for (const [index, colorImagePath] of colorOutputPaths.entries()) {
      const frameName = `frame_${String(index + 1).padStart(6, '0')}.png`;
      const alphaInputPath = alphaInputPaths[index];
      const alphaScaledPath = join(alphaOutputDir, frameName);
      const outputPath = join(options.outputDir, frameName);

      if (!alphaInputPath) {
        throw new Error('Alpha frame sequence became unsynchronized during upscaling.');
      }

      await scaleStillImage({
        inputPath: alphaInputPath,
        outputPath: alphaScaledPath,
        scaleFactor: options.scale,
        flags: options.alphaScaleFlags ?? 'lanczos',
        emitter: options.emitter,
      });

      await mergeImageAlpha({
        colorImagePath,
        alphaImagePath: alphaScaledPath,
        outputPath,
        unpremultiplyAfterMerge: false,
        emitter: options.emitter,
      });
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function resolveWorkingAlphaMode(
  alphaMode: AlphaMode,
  firstInputPath: string,
  emitter: JobEmitter
): Promise<ResolvedAlphaMode> {
  if (alphaMode !== 'auto') {
    emitter.log(`Using forced ${alphaMode} alpha handling for transparent upscale frames.`);
    return alphaMode;
  }

  const detectedAlphaMode = await detectAlphaMode(firstInputPath);
  emitter.log(`Detected ${detectedAlphaMode} alpha from the first source frame.`);
  return detectedAlphaMode;
}
