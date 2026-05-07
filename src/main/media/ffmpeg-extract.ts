import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ImageFormat } from '../../shared/formats';
import { probeVideoDuration } from './ffprobe';
import { getImageCodecArgs } from './ffmpeg-encode';
import { runFfmpeg } from './ffmpeg-runner';
import { getResizeFilter, type ResizeOptions } from './ffmpeg-resize';
import type { JobEmitter } from './types';
import { sanitizePrefix } from './validation';

export async function createImagesFromImageSequence(options: {
  imagePaths: string[];
  outputDir: string;
  format: ImageFormat;
  quality: number;
  prefix: string;
  startNumber: number;
  resize?: ResizeOptions;
  emitter: JobEmitter;
}): Promise<void> {
  await mkdir(options.outputDir, { recursive: true });

  const tempDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-sequence-'));
  const concatFilePath = join(tempDir, 'sequence.txt');
  const concatLines = options.imagePaths.map((imagePath) => `file '${escapeForConcat(imagePath)}'`);
  const safePrefix = sanitizePrefix(options.prefix);
  const outputPattern = join(options.outputDir, `${safePrefix}_%06d.${options.format}`);

  await writeFile(concatFilePath, concatLines.join('\n'), 'utf8');

  const filterChain = [...getResizeFilter(options.resize)].join(',');
  const args = [
    '-hide_banner',
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatFilePath,
    '-vsync',
    '0',
    '-start_number',
    String(Math.max(0, Math.floor(options.startNumber))),
  ];

  if (filterChain) {
    args.push('-vf', filterChain);
  }

  args.push(...getImageCodecArgs(options.format, options.quality), outputPattern);

  try {
    await runFfmpeg({
      args,
      emitter: options.emitter,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function createImagesFromVideo(options: {
  videoPath: string;
  outputDir: string;
  fps: number;
  speed: number;
  quality: number;
  resize?: ResizeOptions;
  format: ImageFormat;
  prefix: string;
  startNumber: number;
  emitter: JobEmitter;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  await mkdir(options.outputDir, { recursive: true });

  let durationSeconds: number | undefined;
  try {
    durationSeconds = await probeVideoDuration(options.videoPath);
  } catch {
    options.emitter.log('Could not probe video duration. Progress will be approximate.');
  }

  const safePrefix = sanitizePrefix(options.prefix);
  const outputPattern = join(options.outputDir, `${safePrefix}_%06d.${options.format}`);

  const filterChain = [
    `setpts=${formatSetpts(options.speed)}*PTS`,
    `fps=${options.fps}`,
    ...getResizeFilter(options.resize),
  ].join(',');

  const args = [
    '-hide_banner',
    '-y',
    '-i',
    options.videoPath,
    '-vf',
    filterChain,
    '-start_number',
    String(Math.max(0, Math.floor(options.startNumber))),
    ...getImageCodecArgs(options.format, options.quality),
    outputPattern,
  ];

  await runFfmpeg({
    args,
    expectedDurationSeconds:
      durationSeconds && durationSeconds > 0 ? durationSeconds / options.speed : undefined,
    onProgress: options.onProgress,
    emitter: options.emitter,
  });
}

function formatSetpts(speed: number): string {
  const value = 1 / speed;
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function escapeForConcat(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/'/g, "'\\''");
}
