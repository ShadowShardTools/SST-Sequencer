import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type { AlphaMode, Anime4kcppModel } from '../../shared/formats';
import { upscaleImageDirectoryPreservingAlpha } from './alpha-upscale';
import { ensureBinaryAvailable, resolveAnime4kcppBinary } from './binaries';
import { getImageFilesFromFolder } from './discovery';
import type { JobEmitter } from './types';

const ANIME4KCPP_SCALES = [2, 3, 4] as const;
const ANIME4KCPP_PROCESSOR_PRIORITY = ['cuda', 'opencl', 'cpu'] as const;

type Anime4kcppProcessor = (typeof ANIME4KCPP_PROCESSOR_PRIORITY)[number];

let cachedAnime4kcppProcessorPromise: Promise<Anime4kcppProcessor> | null = null;

export async function ensureAnime4kcppAvailable(): Promise<void> {
  const binaryPath = resolveAnime4kcppBinary();
  await ensureBinaryAvailable(binaryPath, 'Anime4KCPP');

  if (process.platform === 'win32') {
    await Promise.all([
      stat(join(binaryPath, '..', 'avcodec-60.dll')),
      stat(join(binaryPath, '..', 'avformat-60.dll')),
      stat(join(binaryPath, '..', 'avutil-58.dll')),
      stat(join(binaryPath, '..', 'swresample-4.dll')),
      stat(join(binaryPath, '..', 'swscale-7.dll')),
    ]);
  }
}

export async function upscaleImageDirectory(options: {
  inputDir: string;
  outputDir: string;
  scale: number;
  anime4kcppModel?: Anime4kcppModel;
  preserveAlpha?: boolean;
  alphaMode?: AlphaMode;
  emitter: JobEmitter;
}): Promise<void> {
  if (!ANIME4KCPP_SCALES.includes(options.scale as (typeof ANIME4KCPP_SCALES)[number])) {
    throw new Error(`Unsupported Anime4KCPP scale: ${options.scale}.`);
  }

  await ensureAnime4kcppAvailable();
  await mkdir(options.outputDir, { recursive: true });

  const binaryPath = resolveAnime4kcppBinary();
  const model = options.anime4kcppModel ?? 'arnet-hdn';
  const processor = await resolveAnime4kcppProcessor(binaryPath);
  if (options.preserveAlpha) {
    await upscaleImageDirectoryPreservingAlpha({
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      scale: options.scale,
      alphaMode: options.alphaMode ?? 'auto',
      emitter: options.emitter,
      upscaleOpaqueDirectory: async (inputDir, outputDir) => {
        const inputImagePaths = await getImageFilesFromFolder(inputDir);
        await upscaleFilesWithAnime4kcpp(
          binaryPath,
          processor,
          model,
          inputImagePaths,
          outputDir,
          options.scale,
          options.emitter
        );
      },
    });
    return;
  }

  const inputImagePaths = await getImageFilesFromFolder(options.inputDir);
  await upscaleFilesWithAnime4kcpp(
    binaryPath,
    processor,
    model,
    inputImagePaths,
    options.outputDir,
    options.scale,
    options.emitter
  );
}

async function upscaleFilesWithAnime4kcpp(
  binaryPath: string,
  processor: Anime4kcppProcessor,
  model: Anime4kcppModel,
  inputImagePaths: string[],
  outputDir: string,
  scale: number,
  emitter: JobEmitter
): Promise<void> {
  for (const inputPath of inputImagePaths) {
    const outputName = `${basename(inputPath, extname(inputPath))}.png`;
    await runAnime4kcpp(
      binaryPath,
      [
        '-i',
        inputPath,
        '-o',
        join(outputDir, outputName),
        '-m',
        model,
        '-p',
        processor,
        '-f',
        String(scale),
      ],
      emitter
    );
  }
}

async function resolveAnime4kcppProcessor(binaryPath: string): Promise<Anime4kcppProcessor> {
  if (!cachedAnime4kcppProcessorPromise) {
    cachedAnime4kcppProcessorPromise = detectAnime4kcppProcessor(binaryPath);
  }

  return cachedAnime4kcppProcessorPromise;
}

async function detectAnime4kcppProcessor(binaryPath: string): Promise<Anime4kcppProcessor> {
  for (const processor of ANIME4KCPP_PROCESSOR_PRIORITY) {
    if (processor === 'cpu') {
      return 'cpu';
    }

    const output = await queryAnime4kcpp(binaryPath, ['--ld', '-p', processor]);
    if (hasDeviceEntries(output, processor)) {
      return processor;
    }
  }

  return 'cpu';
}

async function queryAnime4kcpp(binaryPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(`${stdout}\n${stderr}`);
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || 'Anime4KCPP query failed.'));
    });
  });
}

function hasDeviceEntries(output: string, processor: Exclude<Anime4kcppProcessor, 'cpu'>): boolean {
  const sectionName = processor === 'opencl' ? 'OpenCL' : 'CUDA';
  const match = new RegExp(`${sectionName}:\\s*\\n((?:\\s+\\[[^\\n]+\\].*(?:\\n|$))*)`, 'i').exec(
    output
  );

  return Boolean(match?.[1] && /\[\d+\]/.test(match[1]));
}

async function runAnime4kcpp(
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
          outputTail.slice(-8).join(' | ') || `Anime4KCPP exited with code ${code ?? 'unknown'}.`
        )
      );
    });
  });
}
