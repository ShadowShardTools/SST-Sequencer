import { access, copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ensureBinaryAvailable,
  resolveRealcuganBinary,
  resolveRealcuganModelsDir,
} from './binaries';
import { upscaleImageDirectoryPreservingAlpha } from './alpha-upscale';
import { spawnManaged } from './job-runtime';
import type { AlphaMode, RealcuganVariant } from '../../shared/formats';
import type { JobEmitter } from './types';

const REAL_CUGAN_SCALES = [2, 3, 4] as const;
const REAL_CUGAN_VARIANT_MODEL_SUFFIX: Record<RealcuganVariant, string> = {
  'no-denoise': 'no-denoise',
  denoise: 'denoise3x',
  conservative: 'conservative',
};

export async function ensureRealcuganAvailable(): Promise<void> {
  const binaryPath = resolveRealcuganBinary();
  const modelsDir = resolveRealcuganModelsDir('se');

  await ensureBinaryAvailable(binaryPath, 'Real-CUGAN');
  if (!modelsDir) {
    throw new Error('Real-CUGAN models directory could not be resolved.');
  }

  await Promise.all(
    REAL_CUGAN_SCALES.flatMap((scale) => [
      access(join(modelsDir, `up${scale}x-no-denoise.param`)),
      access(join(modelsDir, `up${scale}x-no-denoise.bin`)),
      access(join(modelsDir, `up${scale}x-denoise3x.param`)),
      access(join(modelsDir, `up${scale}x-denoise3x.bin`)),
      access(join(modelsDir, `up${scale}x-conservative.param`)),
      access(join(modelsDir, `up${scale}x-conservative.bin`)),
    ])
  );
}

export async function upscaleImageDirectory(options: {
  inputDir: string;
  outputDir: string;
  scale: number;
  realcuganVariant?: RealcuganVariant;
  preserveAlpha?: boolean;
  alphaMode?: AlphaMode;
  emitter: JobEmitter;
}): Promise<void> {
  if (!REAL_CUGAN_SCALES.includes(options.scale as (typeof REAL_CUGAN_SCALES)[number])) {
    throw new Error(`Unsupported Real-CUGAN scale: ${options.scale}.`);
  }

  await ensureRealcuganAvailable();
  await mkdir(options.outputDir, { recursive: true });

  const binaryPath = resolveRealcuganBinary();
  const variant = options.realcuganVariant ?? 'no-denoise';
  if (options.preserveAlpha) {
    await upscaleImageDirectoryPreservingAlpha({
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      scale: options.scale,
      alphaMode: options.alphaMode ?? 'auto',
      emitter: options.emitter,
      upscaleOpaqueDirectory: (inputDir, outputDir) =>
        runRealcugan(binaryPath, inputDir, outputDir, options.scale, variant, options.emitter),
    });
    return;
  }

  await runRealcugan(
    binaryPath,
    options.inputDir,
    options.outputDir,
    options.scale,
    variant,
    options.emitter
  );
}

async function runRealcugan(
  binaryPath: string,
  inputDir: string,
  outputDir: string,
  scale: number,
  variant: RealcuganVariant,
  emitter: JobEmitter
): Promise<void> {
  const { modelDir, noiseLevel, cleanup } = await prepareRealcuganModelDir(scale, variant);

  try {
    await runRealcuganProcess(
      binaryPath,
      [
        '-i',
        inputDir,
        '-o',
        outputDir,
        '-n',
        String(noiseLevel),
        '-s',
        String(scale),
        '-m',
        modelDir,
        '-f',
        'png',
      ],
      emitter
    );
  } finally {
    await cleanup();
  }
}

async function prepareRealcuganModelDir(
  scale: number,
  variant: RealcuganVariant
): Promise<{ modelDir: string; noiseLevel: number; cleanup: () => Promise<void> }> {
  const modelsDir = resolveRealcuganModelsDir('se');

  if (variant === 'no-denoise') {
    return {
      modelDir: modelsDir,
      noiseLevel: -1,
      cleanup: async () => undefined,
    };
  }

  if (variant === 'denoise') {
    return {
      modelDir: modelsDir,
      noiseLevel: 3,
      cleanup: async () => undefined,
    };
  }

  const tempModelsDir = await mkdtemp(join(tmpdir(), 'sst-realcugan-conservative-'));
  const sourceBase = `up${scale}x-${REAL_CUGAN_VARIANT_MODEL_SUFFIX.conservative}`;
  const targetBase = `up${scale}x-no-denoise`;

  await copyFile(join(modelsDir, `${sourceBase}.param`), join(tempModelsDir, `${targetBase}.param`));
  await copyFile(join(modelsDir, `${sourceBase}.bin`), join(tempModelsDir, `${targetBase}.bin`));

  return {
    modelDir: tempModelsDir,
    noiseLevel: -1,
    cleanup: async () => {
      await rm(tempModelsDir, { recursive: true, force: true });
    },
  };
}

async function runRealcuganProcess(
  binaryPath: string,
  args: string[],
  emitter: JobEmitter
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnManaged(binaryPath, args, {
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
          outputTail.slice(-8).join(' | ') || `Real-CUGAN exited with code ${code ?? 'unknown'}.`
        )
      );
    });
  });
}
