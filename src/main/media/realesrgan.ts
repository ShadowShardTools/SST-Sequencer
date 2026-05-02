import { spawn } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ensureBinaryAvailable,
  resolveRealEsrganBinary,
  resolveRealEsrganModelsDir,
} from './binaries';
import { upscaleImageDirectoryPreservingAlpha } from './alpha-upscale';
import type { AlphaMode } from '../../shared/formats';
import type { JobEmitter } from './types';

const REAL_ESRGAN_MODEL = 'realesr-animevideov3';
const REAL_ESRGAN_SCALES = [2, 3, 4] as const;

export async function ensureRealEsrganAvailable(): Promise<void> {
  const binaryPath = resolveRealEsrganBinary();
  const modelsDir = resolveRealEsrganModelsDir();

  await ensureBinaryAvailable(binaryPath, 'Real-ESRGAN');
  if (!modelsDir) {
    throw new Error('Real-ESRGAN models directory could not be resolved.');
  }

  await Promise.all(
    REAL_ESRGAN_SCALES.flatMap((scale) => [
      access(join(modelsDir, `${REAL_ESRGAN_MODEL}-x${scale}.param`)),
      access(join(modelsDir, `${REAL_ESRGAN_MODEL}-x${scale}.bin`)),
    ])
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
  if (!REAL_ESRGAN_SCALES.includes(options.scale as (typeof REAL_ESRGAN_SCALES)[number])) {
    throw new Error(`Unsupported Real-ESRGAN scale: ${options.scale}.`);
  }

  await ensureRealEsrganAvailable();
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
        runRealEsrgan(
          binaryPath,
          [
            '-i',
            inputDir,
            '-o',
            outputDir,
            '-n',
            REAL_ESRGAN_MODEL,
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

  const args = [
    '-i',
    options.inputDir,
    '-o',
    options.outputDir,
    '-n',
    REAL_ESRGAN_MODEL,
    '-s',
    String(options.scale),
    '-m',
    modelsDir,
    '-f',
    'png',
  ];

  await runRealEsrgan(binaryPath, args, options.emitter);
}

async function runRealEsrgan(
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
          outputTail.slice(-8).join(' | ') || `Real-ESRGAN exited with code ${code ?? 'unknown'}.`
        )
      );
    });
  });
}
