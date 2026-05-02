import { spawn } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ensureBinaryAvailable,
  resolveRealcuganBinary,
  resolveRealcuganModelsDir,
} from './binaries';
import { upscaleImageDirectoryPreservingAlpha } from './alpha-upscale';
import type { AlphaMode } from '../../shared/formats';
import type { JobEmitter } from './types';

const REAL_CUGAN_SCALES = [2, 3, 4] as const;
const REAL_CUGAN_MODELS: Record<(typeof REAL_CUGAN_SCALES)[number], string> = {
  2: 'up2x-no-denoise',
  3: 'up3x-no-denoise',
  4: 'up4x-no-denoise',
};

export async function ensureRealcuganAvailable(): Promise<void> {
  const binaryPath = resolveRealcuganBinary();
  const modelsDir = resolveRealcuganModelsDir();

  await ensureBinaryAvailable(binaryPath, 'Real-CUGAN');
  if (!modelsDir) {
    throw new Error('Real-CUGAN models directory could not be resolved.');
  }

  await Promise.all(
    REAL_CUGAN_SCALES.flatMap((scale) => {
      const modelName = REAL_CUGAN_MODELS[scale];
      return [
        access(join(modelsDir, `${modelName}.param`)),
        access(join(modelsDir, `${modelName}.bin`)),
      ];
    })
  );
}

export async function upscaleImageDirectory(options: {
  inputDir: string;
  outputDir: string;
  scale: number;
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
  const modelsDir = resolveRealcuganModelsDir();
  if (options.preserveAlpha) {
    await upscaleImageDirectoryPreservingAlpha({
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      scale: options.scale,
      alphaMode: options.alphaMode ?? 'auto',
      emitter: options.emitter,
      upscaleOpaqueDirectory: (inputDir, outputDir) =>
        runRealcugan(
          binaryPath,
          [
            '-i',
            inputDir,
            '-o',
            outputDir,
            '-n',
            '-1',
            '-s',
            String(options.scale),
            '-m',
            modelsDir,
            '-f',
            'png',
          ],
          options.emitter
        ),
    });
    return;
  }

  await runRealcugan(
    binaryPath,
    [
      '-i',
      options.inputDir,
      '-o',
      options.outputDir,
      '-n',
      '-1',
      '-s',
      String(options.scale),
      '-m',
      modelsDir,
      '-f',
      'png',
    ],
    options.emitter
  );
}

async function runRealcugan(
  binaryPath: string,
  args: string[],
  emitter: JobEmitter
): Promise<void> {
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
          outputTail.slice(-8).join(' | ') || `Real-CUGAN exited with code ${code ?? 'unknown'}.`
        )
      );
    });
  });
}
