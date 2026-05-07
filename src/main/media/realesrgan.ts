import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import {
  ensureBinaryAvailable,
  resolveRealEsrganBinary,
  resolveRealEsrganModelsDir,
} from './binaries';
import { upscaleImageDirectoryPreservingAlpha } from './alpha-upscale';
import { getImageFilesFromFolder } from './discovery';
import { scaleStillImage } from './ffmpeg';
import { spawnManaged } from './job-runtime';
import type { AlphaMode, RealEsrganModel } from '../../shared/formats';
import type { JobEmitter } from './types';

const REAL_ESRGAN_NATIVE_SCALES = [2, 3, 4] as const;
const REAL_ESRGAN_REQUESTED_SCALES = [2, 3, 4, 6, 8] as const;
const DEFAULT_REAL_ESRGAN_MODEL: RealEsrganModel = 'realesrgan-x4plus';
const REAL_ESRGAN_PREFERRED_NATIVE_SCALE = 4;

export async function ensureRealEsrganAvailable(
  model: RealEsrganModel = DEFAULT_REAL_ESRGAN_MODEL
): Promise<void> {
  const binaryPath = resolveRealEsrganBinary();
  const modelsDir = resolveRealEsrganModelsDir();

  await ensureBinaryAvailable(binaryPath, 'Real-ESRGAN');
  if (!modelsDir) {
    throw new Error('Real-ESRGAN models directory could not be resolved.');
  }

  await Promise.all(getRequiredRealEsrganModelFiles(model).map((fileName) => access(join(modelsDir, fileName))));
}

export async function upscaleImageDirectory(options: {
  inputDir: string;
  outputDir: string;
  scale: number;
  preserveAlpha?: boolean;
  alphaMode?: AlphaMode;
  realEsrganModel?: RealEsrganModel;
  emitter: JobEmitter;
}): Promise<void> {
  if (
    !REAL_ESRGAN_REQUESTED_SCALES.includes(
      options.scale as (typeof REAL_ESRGAN_REQUESTED_SCALES)[number]
    )
  ) {
    throw new Error(`Unsupported Real-ESRGAN scale: ${options.scale}.`);
  }

  const model = options.realEsrganModel ?? DEFAULT_REAL_ESRGAN_MODEL;
  await ensureRealEsrganAvailable(model);
  await mkdir(options.outputDir, { recursive: true });

  const binaryPath = resolveRealEsrganBinary();
  const modelsDir = resolveRealEsrganModelsDir();
  if (options.preserveAlpha) {
    await upscaleImageDirectoryPreservingAlpha({
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      scale: options.scale,
      alphaMode: options.alphaMode ?? 'auto',
      emitter: options.emitter,
      upscaleOpaqueDirectory: (inputDir, outputDir) =>
        runRealEsrganDirectory(
          binaryPath,
          modelsDir,
          inputDir,
          outputDir,
          options.scale,
          model,
          options.emitter
        ),
    });
    return;
  }

  await runRealEsrganDirectory(
    binaryPath,
    modelsDir,
    options.inputDir,
    options.outputDir,
    options.scale,
    model,
    options.emitter
  );
}

function getRequiredRealEsrganModelFiles(model: RealEsrganModel): string[] {
  if (model === 'realesr-animevideov3') {
    return REAL_ESRGAN_NATIVE_SCALES.flatMap((scale) => [
      `${model}-x${scale}.param`,
      `${model}-x${scale}.bin`,
    ]);
  }

  return [`${model}.param`, `${model}.bin`];
}

async function runRealEsrganDirectory(
  binaryPath: string,
  modelsDir: string,
  inputDir: string,
  outputDir: string,
  scale: number,
  model: RealEsrganModel,
  emitter: JobEmitter
): Promise<void> {
  const nativeScale = getRealEsrganNativeScale(scale);

  if (nativeScale === scale) {
    await runRealEsrganNativeDirectory(binaryPath, modelsDir, inputDir, outputDir, nativeScale, model, emitter);
    return;
  }

  const tempNativeDir = await mkdtemp(join(tmpdir(), 'sst-realesrgan-native-'));
  try {
    emitter.log(
      `Real-ESRGAN does not natively support ${scale}x for ${model}. Running ${nativeScale}x and resizing to ${scale}x.`
    );
    await runRealEsrganNativeDirectory(
      binaryPath,
      modelsDir,
      inputDir,
      tempNativeDir,
      nativeScale,
      model,
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

async function runRealEsrganNativeDirectory(
  binaryPath: string,
  modelsDir: string,
  inputDir: string,
  outputDir: string,
  scale: number,
  model: RealEsrganModel,
  emitter: JobEmitter
): Promise<void> {
  await runRealEsrgan(
    binaryPath,
    ['-i', inputDir, '-o', outputDir, '-n', model, '-s', String(scale), '-m', modelsDir, '-f', 'png'],
    emitter
  );
}

export function getRealEsrganNativeScale(scale: number): number {
  if (!REAL_ESRGAN_REQUESTED_SCALES.includes(scale as (typeof REAL_ESRGAN_REQUESTED_SCALES)[number])) {
    throw new Error(`Unsupported Real-ESRGAN scale: ${scale}.`);
  }

  if (scale === REAL_ESRGAN_PREFERRED_NATIVE_SCALE) {
    return REAL_ESRGAN_PREFERRED_NATIVE_SCALE;
  }

  return REAL_ESRGAN_PREFERRED_NATIVE_SCALE;
}

async function runRealEsrgan(
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
          outputTail.slice(-8).join(' | ') || `Real-ESRGAN exited with code ${code ?? 'unknown'}.`
        )
      );
    });
  });
}
