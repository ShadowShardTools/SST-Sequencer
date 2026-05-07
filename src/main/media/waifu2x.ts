import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AlphaMode, Waifu2xModel, Waifu2xNoiseLevel } from '../../shared/formats';
import { ensureBinaryAvailable, resolveWaifu2xBinary, resolveWaifu2xModelsDir } from './binaries';
import { upscaleImageDirectoryPreservingAlpha } from './alpha-upscale';
import { getImageFilesFromFolder } from './discovery';
import { scaleStillImage } from './ffmpeg';
import type { JobEmitter } from './types';

const WAIFU2X_SCALES = [2, 3, 4] as const;
const WAIFU2X_NATIVE_SCALE = {
  2: 2,
  3: 4,
  4: 4,
} as const;
export async function ensureWaifu2xAvailable(model: Waifu2xModel = 'cunet'): Promise<void> {
  const binaryPath = resolveWaifu2xBinary();
  const modelsDir = resolveWaifu2xModelsDir(model);

  await ensureBinaryAvailable(binaryPath, 'Waifu2x');
  if (!modelsDir) {
    throw new Error('Waifu2x models directory could not be resolved.');
  }

  await Promise.all([
    access(join(modelsDir, 'scale2.0x_model.param')),
    access(join(modelsDir, 'scale2.0x_model.bin')),
    access(join(modelsDir, 'noise3_scale2.0x_model.param')),
    access(join(modelsDir, 'noise3_scale2.0x_model.bin')),
  ]);
}

export async function upscaleImageDirectory(options: {
  inputDir: string;
  outputDir: string;
  scale: number;
  waifu2xModel?: Waifu2xModel;
  waifu2xNoiseLevel?: Waifu2xNoiseLevel;
  preserveAlpha?: boolean;
  alphaMode?: AlphaMode;
  emitter: JobEmitter;
}): Promise<void> {
  if (!WAIFU2X_SCALES.includes(options.scale as (typeof WAIFU2X_SCALES)[number])) {
    throw new Error(`Unsupported Waifu2x scale: ${options.scale}.`);
  }

  const model = options.waifu2xModel ?? 'cunet';
  const noiseLevel = options.waifu2xNoiseLevel ?? 'off';
  await ensureWaifu2xAvailable(model);
  await mkdir(options.outputDir, { recursive: true });

  const binaryPath = resolveWaifu2xBinary();
  const modelsDir = resolveWaifu2xModelsDir(model);

  if (options.preserveAlpha) {
    await upscaleImageDirectoryPreservingAlpha({
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      scale: options.scale,
      alphaMode: options.alphaMode ?? 'auto',
      emitter: options.emitter,
      upscaleOpaqueDirectory: (inputDir, outputDir) =>
        runWaifu2xDirectory(
          binaryPath,
          modelsDir,
          inputDir,
          outputDir,
          options.scale,
          noiseLevel,
          options.emitter
        ),
    });
    return;
  }

  await runWaifu2xDirectory(
    binaryPath,
    modelsDir,
    options.inputDir,
    options.outputDir,
    options.scale,
    noiseLevel,
    options.emitter
  );
}

async function runWaifu2xDirectory(
  binaryPath: string,
  modelsDir: string,
  inputDir: string,
  outputDir: string,
  scale: number,
  noiseLevel: Waifu2xNoiseLevel,
  emitter: JobEmitter
): Promise<void> {
  const nativeScale = WAIFU2X_NATIVE_SCALE[scale as keyof typeof WAIFU2X_NATIVE_SCALE];
  const nativeNoiseLevel = noiseLevel === 'off' ? -1 : Number(noiseLevel);

  if (nativeScale === scale) {
    await runWaifu2x(
      binaryPath,
      [
        '-i',
        inputDir,
        '-o',
        outputDir,
        '-m',
        modelsDir,
        '-n',
        String(nativeNoiseLevel),
        '-s',
        String(nativeScale),
        '-f',
        'png',
      ],
      emitter
    );
    return;
  }

  const tempNativeDir = await mkdtemp(join(tmpdir(), 'sst-waifu2x-native-'));
  try {
    emitter.log('Waifu2x does not natively support 3x. Running 4x and resizing down to 3x.');
    await runWaifu2x(
      binaryPath,
      [
        '-i',
        inputDir,
        '-o',
        tempNativeDir,
        '-m',
        modelsDir,
        '-n',
        String(nativeNoiseLevel),
        '-s',
        String(nativeScale),
        '-f',
        'png',
      ],
      emitter
    );

    const nativeOutputPaths = await getImageFilesFromFolder(tempNativeDir);
    for (const inputPath of nativeOutputPaths) {
      await scaleStillImage({
        inputPath,
        outputPath: join(outputDir, `${basename(inputPath, extname(inputPath))}.png`),
        scaleFactor: scale / nativeScale,
        flags: 'lanczos',
        emitter,
      });
    }
  } finally {
    await rm(tempNativeDir, { recursive: true, force: true });
  }
}

async function runWaifu2x(binaryPath: string, args: string[], emitter: JobEmitter): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      windowsHide: true,
    });

    const outputTail: string[] = [];
    const handleChunk = (chunk: Buffer): void => {
      const text = chunk.toString('utf8');
      const lines = text.replace(/\r/g, '\n').split('\n');

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }

        outputTail.push(line);
        if (outputTail.length > 20) {
          outputTail.shift();
        }

        if (/error|failed|invalid/i.test(line)) {
          emitter.log(line, 'error');
        }
      }
    };

    child.stdout.on('data', handleChunk);
    child.stderr.on('data', handleChunk);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          outputTail.slice(-8).join(' | ') || `Waifu2x exited with code ${code ?? 'unknown'}.`
        )
      );
    });
  });
}
