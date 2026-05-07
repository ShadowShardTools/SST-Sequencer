import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AlphaMode } from '../../shared/formats';
import { ensureBinaryAvailable, resolveRealSrBinary, resolveRealSrModelsDir } from './binaries';
import { upscaleImageDirectoryPreservingAlpha } from './alpha-upscale';
import { getImageFilesFromFolder } from './discovery';
import { scaleStillImage } from './ffmpeg';
import { spawnManaged } from './job-runtime';
import type { JobEmitter } from './types';

const REALSR_SCALES = [2, 3, 4] as const;
const REALSR_NATIVE_SCALE = 4;

export async function ensureRealSrAvailable(): Promise<void> {
  const binaryPath = resolveRealSrBinary();
  const modelsDir = resolveRealSrModelsDir();

  await ensureBinaryAvailable(binaryPath, 'RealSR');
  if (!modelsDir) {
    throw new Error('RealSR models directory could not be resolved.');
  }

  await access(join(modelsDir, 'x4.param'));
  await access(join(modelsDir, 'x4.bin'));
}

export async function upscaleImageDirectory(options: {
  inputDir: string;
  outputDir: string;
  scale: number;
  preserveAlpha?: boolean;
  alphaMode?: AlphaMode;
  emitter: JobEmitter;
}): Promise<void> {
  if (!REALSR_SCALES.includes(options.scale as (typeof REALSR_SCALES)[number])) {
    throw new Error(`Unsupported RealSR scale: ${options.scale}.`);
  }

  await ensureRealSrAvailable();
  await mkdir(options.outputDir, { recursive: true });

  const binaryPath = resolveRealSrBinary();
  const modelsDir = resolveRealSrModelsDir();

  if (options.preserveAlpha) {
    await upscaleImageDirectoryPreservingAlpha({
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      scale: options.scale,
      alphaMode: options.alphaMode ?? 'auto',
      emitter: options.emitter,
      upscaleOpaqueDirectory: (inputDir, outputDir) =>
        runRealSrDirectory(
          binaryPath,
          modelsDir,
          inputDir,
          outputDir,
          options.scale,
          options.emitter
        ),
    });
    return;
  }

  await runRealSrDirectory(
    binaryPath,
    modelsDir,
    options.inputDir,
    options.outputDir,
    options.scale,
    options.emitter
  );
}

async function runRealSrDirectory(
  binaryPath: string,
  modelsDir: string,
  inputDir: string,
  outputDir: string,
  scale: number,
  emitter: JobEmitter
): Promise<void> {
  if (scale === REALSR_NATIVE_SCALE) {
    await runRealSr(
      binaryPath,
      ['-i', inputDir, '-o', outputDir, '-s', String(scale), '-m', modelsDir, '-f', 'png'],
      emitter
    );
    return;
  }

  const tempNativeDir = await mkdtemp(join(tmpdir(), 'sst-realsr-native-'));
  try {
    emitter.log(`RealSR only supports 4x natively. Running 4x and resizing down to ${scale}x.`);
    await runRealSr(
      binaryPath,
      [
        '-i',
        inputDir,
        '-o',
        tempNativeDir,
        '-s',
        String(REALSR_NATIVE_SCALE),
        '-m',
        modelsDir,
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
        scaleFactor: scale / REALSR_NATIVE_SCALE,
        flags: 'lanczos',
        emitter,
      });
    }
  } finally {
    await rm(tempNativeDir, { recursive: true, force: true });
  }
}

async function runRealSr(binaryPath: string, args: string[], emitter: JobEmitter): Promise<void> {
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
          outputTail.slice(-8).join(' | ') || `RealSR exited with code ${code ?? 'unknown'}.`
        )
      );
    });
  });
}
