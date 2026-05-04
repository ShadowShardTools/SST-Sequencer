import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AlphaMode, ImageFormat, VideoFormat } from '../../shared/formats';
import { ensureBinaryAvailable, ffmpegBinary } from './binaries';
import { probeMediaInfo, probeVideoDuration } from './ffprobe';
import type { JobEmitter } from './types';
import { sanitizePrefix } from './validation';

type FfmpegRunOptions = {
  args: string[];
  expectedDurationSeconds?: number;
  onProgress?: (percent: number) => void;
  emitter: JobEmitter;
};

type ResizeOptions = {
  width: number;
  height: number;
  flags?: 'lanczos' | 'neighbor' | 'bilinear';
};

export type ResolvedAlphaMode = Exclude<AlphaMode, 'auto'>;
export type SequenceToVideoFilterSpec = {
  argument: '-vf' | '-filter_complex';
  value: string;
};

export async function createVideoFromImages(options: {
  imagePaths: string[];
  outputPath: string;
  fps: number;
  speed: number;
  quality: number;
  format: VideoFormat;
  resize?: ResizeOptions;
  emitter: JobEmitter;
  onProgress?: (percent: number) => void;
  extraVideoFilters?: string[];
}): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), 'sst-sequencer-'));
  const concatFilePath = join(tempDir, 'sequence.txt');
  const durationPerFrame = 1 / options.fps;
  const concatLines: string[] = [];

  for (const imagePath of options.imagePaths) {
    concatLines.push(`file '${escapeForConcat(imagePath)}'`);
    concatLines.push(`duration ${durationPerFrame.toFixed(8)}`);
  }

  concatLines.push(`file '${escapeForConcat(options.imagePaths.at(-1) ?? '')}'`);

  await writeFile(concatFilePath, concatLines.join('\n'), 'utf8');

  const args = ['-hide_banner', '-y', '-f', 'concat', '-safe', '0', '-i', concatFilePath];
  const filterSpec = buildSequenceToVideoFilterSpec({
    fps: options.fps,
    speed: options.speed,
    quality: options.quality,
    format: options.format,
    resize: options.resize,
    extraVideoFilters: options.extraVideoFilters,
  });

  if (options.format === 'gif-palette') {
    args.push(
      filterSpec.argument,
      filterSpec.value,
      '-loop',
      '0',
      options.outputPath
    );
  } else if (options.format === 'apng') {
    args.push(
      filterSpec.argument,
      filterSpec.value,
      '-plays',
      '0',
      '-compression_level',
      String(mapQualityToPngCompressionLevel(options.quality)),
      '-f',
      'apng',
      options.outputPath
    );
  } else {
    args.push(
      filterSpec.argument,
      filterSpec.value,
      ...getVideoCodecArgs(options.format, options.quality),
      options.outputPath
    );
  }

  try {
    await runFfmpeg({
      args,
      expectedDurationSeconds: options.imagePaths.length / options.fps / options.speed,
      onProgress: options.onProgress,
      emitter: options.emitter,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function buildSequenceToVideoFilterSpec(options: {
  fps: number;
  speed: number;
  quality: number;
  format: VideoFormat;
  resize?: ResizeOptions;
  extraVideoFilters?: string[];
}): SequenceToVideoFilterSpec {
  const baseFilters = [
    `setpts=${formatSetpts(options.speed)}*PTS`,
    `fps=${options.fps}`,
    ...getResizeFilter(options.resize),
    ...(options.extraVideoFilters ?? []),
  ];

  if (options.format === 'gif-palette') {
    const maxColors = mapQualityToGifColors(options.quality);
    return {
      argument: '-filter_complex',
      value:
        `[0:v]${baseFilters.join(',')},split[frames][palette_source];` +
        `[palette_source]palettegen=max_colors=${maxColors}:stats_mode=diff[palette];` +
        '[frames][palette]paletteuse=dither=sierra2_4a',
    };
  }

  if (options.format === 'apng') {
    return {
      argument: '-vf',
      value: [...baseFilters, 'format=rgba'].join(','),
    };
  }

  return {
    argument: '-vf',
    value: [...baseFilters, 'pad=ceil(iw/2)*2:ceil(ih/2)*2', ...getVideoPostFilters(options.format)].join(','),
  };
}

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

export async function extractImageColorAndAlpha(options: {
  inputPath: string;
  colorOutputPath: string;
  alphaOutputPath: string;
  alphaMode: ResolvedAlphaMode;
  emitter: JobEmitter;
}): Promise<void> {
  const colorFilter =
    options.alphaMode === 'premultiplied'
      ? '[color_src]unpremultiply=inplace=1,format=rgb24[color];'
      : '[color_src]format=rgb24[color];';
  const args = [
    '-hide_banner',
    '-y',
    '-i',
    options.inputPath,
    '-filter_complex',
    `[0:v]format=rgba,split[color_src][alpha_src];${colorFilter}[alpha_src]format=rgba,alphaextract[alpha]`,
    '-map',
    '[color]',
    '-frames:v',
    '1',
    '-update',
    '1',
    options.colorOutputPath,
    '-map',
    '[alpha]',
    '-frames:v',
    '1',
    '-update',
    '1',
    options.alphaOutputPath,
  ];

  await runFfmpeg({
    args,
    emitter: options.emitter,
  });
}

export async function detectAlphaMode(inputPath: string): Promise<ResolvedAlphaMode> {
  const mediaInfo = await probeMediaInfo(inputPath);
  if (!mediaInfo.width || !mediaInfo.height || !mediaInfo.hasAlpha) {
    return 'straight';
  }

  await ensureBinaryAvailable(ffmpegBinary, 'FFmpeg');

  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegBinary,
      [
        '-hide_banner',
        '-v',
        'error',
        '-i',
        inputPath,
        '-frames:v',
        '1',
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgba',
        '-',
      ],
      {
        windowsHide: true,
      }
    );

    const chunks: Buffer[] = [];
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || 'FFmpeg failed to inspect alpha mode.'));
        return;
      }

      const rgba = Buffer.concat(chunks);
      resolve(estimateAlphaModeFromRgba(rgba, mediaInfo.width ?? 0, mediaInfo.height ?? 0));
    });
  });
}

export async function scaleStillImage(options: {
  inputPath: string;
  outputPath: string;
  scaleFactor: number;
  flags: 'lanczos' | 'neighbor' | 'bilinear';
  emitter: JobEmitter;
}): Promise<void> {
  const args = [
    '-hide_banner',
    '-y',
    '-i',
    options.inputPath,
    '-vf',
    `scale=iw*${options.scaleFactor}:ih*${options.scaleFactor}:flags=${options.flags}`,
    '-frames:v',
    '1',
    '-update',
    '1',
    options.outputPath,
  ];

  await runFfmpeg({
    args,
    emitter: options.emitter,
  });
}

export async function mergeImageAlpha(options: {
  colorImagePath: string;
  alphaImagePath: string;
  outputPath: string;
  unpremultiplyAfterMerge?: boolean;
  emitter: JobEmitter;
}): Promise<void> {
  const postMergeFilter =
    (options.unpremultiplyAfterMerge ?? true) ? ',unpremultiply=inplace=1' : '';
  const args = [
    '-hide_banner',
    '-y',
    '-i',
    options.colorImagePath,
    '-i',
    options.alphaImagePath,
    '-filter_complex',
    `[0:v][1:v]alphamerge${postMergeFilter},format=rgba`,
    '-frames:v',
    '1',
    '-update',
    '1',
    options.outputPath,
  ];

  await runFfmpeg({
    args,
    emitter: options.emitter,
  });
}

async function runFfmpeg(options: FfmpegRunOptions): Promise<void> {
  await ensureBinaryAvailable(ffmpegBinary, 'FFmpeg');

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBinary, options.args, {
      windowsHide: true,
    });

    const stderrTail: string[] = [];
    let remainder = '';
    let lastReportedPercent = -1;

    child.stderr.on('data', (chunk: Buffer) => {
      remainder += chunk.toString('utf8').replace(/\r/g, '\n');
      const segments = remainder.split('\n');
      remainder = segments.pop() ?? '';

      for (const segment of segments) {
        const line = segment.trim();
        if (!line) {
          continue;
        }

        stderrTail.push(line);
        if (stderrTail.length > 30) {
          stderrTail.shift();
        }

        const match = /time=(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/.exec(line);
        if (match && options.expectedDurationSeconds && options.expectedDurationSeconds > 0) {
          const seconds = parseTimestamp(match[1]);
          const percent = clamp((seconds / options.expectedDurationSeconds) * 100, 0, 99);
          const rounded = Math.floor(percent);

          if (rounded > lastReportedPercent) {
            lastReportedPercent = rounded;
            options.onProgress?.(rounded);
          }
        }

        if (/error|invalid|failed/i.test(line)) {
          options.emitter.log(line, 'error');
        }
      }
    });

    child.on('error', (error) => reject(error));

    child.on('close', (code) => {
      if (code === 0) {
        options.onProgress?.(100);
        resolve();
      } else {
        reject(
          new Error(
            stderrTail.slice(-8).join(' | ') || `FFmpeg exited with code ${code ?? 'unknown'}.`
          )
        );
      }
    });
  });
}

function getVideoCodecArgs(format: VideoFormat, quality: number): string[] {
  if (format === 'webm-vp9') {
    return [
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      String(mapQualityToRange(quality, 63)),
      '-pix_fmt',
      'yuv420p',
    ];
  }

  if (format === 'mp4-hevc' || format === 'mov-hevc' || format === 'mkv-hevc') {
    const args = [
      '-c:v',
      'libx265',
      '-preset',
      'medium',
      '-crf',
      String(mapQualityToRange(quality, 40)),
      '-pix_fmt',
      'yuv420p',
    ];

    if (format === 'mp4-hevc' || format === 'mov-hevc') {
      args.push('-tag:v', 'hvc1');
    }

    if (format === 'mp4-hevc') {
      args.push('-movflags', '+faststart');
    }

    return args;
  }

  if (format === 'prores422') {
    return [
      '-c:v',
      'prores_ks',
      '-profile:v',
      '2',
      '-qscale:v',
      String(mapQualityToQscale(quality)),
      '-pix_fmt',
      'yuv422p10le',
    ];
  }

  if (format === 'prores4444') {
    return [
      '-c:v',
      'prores_ks',
      '-profile:v',
      '4',
      '-qscale:v',
      String(mapQualityToQscale(quality)),
      '-pix_fmt',
      'yuva444p10le',
    ];
  }

  const args = [
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    String(mapQualityToRange(quality, 40)),
    '-pix_fmt',
    'yuv420p',
  ];

  if (format === 'mp4-h264') {
    args.push('-movflags', '+faststart');
  }

  return args;
}

function getVideoPostFilters(format: VideoFormat): string[] {
  if (format === 'prores422') {
    return ['format=yuv422p10le'];
  }

  if (format === 'prores4444') {
    return ['format=yuva444p10le'];
  }

  return ['format=yuv420p'];
}

function getResizeFilter(resize: ResizeOptions | undefined): string[] {
  if (!resize) {
    return [];
  }

  return [`scale=${resize.width}:${resize.height}:flags=${resize.flags ?? 'lanczos'}`];
}

function mapQualityToRange(quality: number, maxValue: number): number {
  const normalized = clamp((100 - quality) / 99, 0, 1);
  return Math.round(normalized * maxValue);
}

function mapQualityToQscale(quality: number): number {
  const normalized = clamp((100 - quality) / 99, 0, 1);
  return Math.max(1, Math.round(1 + normalized * 30));
}

function mapQualityToPngCompressionLevel(quality: number): number {
  const normalized = clamp((100 - quality) / 99, 0, 1);
  return Math.round(normalized * 9);
}

function mapQualityToGifColors(quality: number): number {
  const normalized = clamp((quality - 1) / 99, 0, 1);
  return Math.max(16, Math.round(16 + normalized * 240));
}

function getImageCodecArgs(format: ImageFormat, quality: number): string[] {
  switch (format) {
    case 'jpg':
      return ['-q:v', String(mapQualityToJpegQscale(quality))];
    case 'png':
      return ['-compression_level', String(mapQualityToPngCompressionLevel(quality))];
    case 'tga':
      return ['-pix_fmt', 'rgba'];
    case 'webp':
      return ['-compression_level', '6', '-quality', String(clamp(Math.round(quality), 1, 100))];
    default:
      return [];
  }
}

function mapQualityToJpegQscale(quality: number): number {
  const normalized = clamp((100 - quality) / 99, 0, 1);
  return Math.max(1, Math.round(1 + normalized * 30));
}

function formatSetpts(speed: number): string {
  const value = 1 / speed;
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function parseTimestamp(value: string): number {
  const [hours, minutes, seconds] = value.split(':');
  return (
    Number.parseInt(hours, 10) * 3600 +
    Number.parseInt(minutes, 10) * 60 +
    Number.parseFloat(seconds)
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeForConcat(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/'/g, "'\\''");
}

export function estimateAlphaModeFromRgba(
  rgba: Buffer,
  width: number,
  height: number
): ResolvedAlphaMode {
  if (!width || !height || rgba.length < width * height * 4) {
    return 'straight';
  }

  const pixelCount = width * height;
  const samplingStep = Math.max(1, Math.floor(Math.sqrt(pixelCount / 12000)));
  let straightVotes = 0;
  let premultipliedVotes = 0;
  let samples = 0;

  for (let y = 0; y < height; y += samplingStep) {
    for (let x = 0; x < width; x += samplingStep) {
      const offset = (y * width + x) * 4;
      const alpha = rgba[offset + 3];
      if (alpha <= 8 || alpha >= 247) {
        continue;
      }

      samples += 1;
      const red = rgba[offset];
      const green = rgba[offset + 1];
      const blue = rgba[offset + 2];
      const maxChannel = Math.max(red, green, blue);

      if (maxChannel > alpha + 8) {
        straightVotes += 3;
      } else if (maxChannel <= alpha + 2) {
        premultipliedVotes += 1;
      }

      const neighbor = findOpaqueNeighborColor(rgba, width, height, x, y);
      if (!neighbor) {
        continue;
      }

      const alphaScale = alpha / 255;
      const straightError =
        Math.abs(red - neighbor.r) + Math.abs(green - neighbor.g) + Math.abs(blue - neighbor.b);
      const premultipliedError =
        Math.abs(red - neighbor.r * alphaScale) +
        Math.abs(green - neighbor.g * alphaScale) +
        Math.abs(blue - neighbor.b * alphaScale);

      if (straightError + 12 < premultipliedError) {
        straightVotes += 2;
      } else if (premultipliedError + 12 < straightError) {
        premultipliedVotes += 2;
      }
    }
  }

  if (samples === 0) {
    return 'straight';
  }

  if (
    premultipliedVotes >= Math.max(4, Math.ceil(samples * 1.5)) &&
    premultipliedVotes > straightVotes * 1.15
  ) {
    return 'premultiplied';
  }

  return 'straight';
}

function findOpaqueNeighborColor(
  rgba: Buffer,
  width: number,
  height: number,
  x: number,
  y: number
): { r: number; g: number; b: number } | null {
  for (let radius = 1; radius <= 2; radius += 1) {
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;

    for (
      let neighborY = Math.max(0, y - radius);
      neighborY <= Math.min(height - 1, y + radius);
      neighborY += 1
    ) {
      for (
        let neighborX = Math.max(0, x - radius);
        neighborX <= Math.min(width - 1, x + radius);
        neighborX += 1
      ) {
        if (neighborX === x && neighborY === y) {
          continue;
        }

        const offset = (neighborY * width + neighborX) * 4;
        if (rgba[offset + 3] < 250) {
          continue;
        }

        sumR += rgba[offset];
        sumG += rgba[offset + 1];
        sumB += rgba[offset + 2];
        count += 1;
      }
    }

    if (count > 0) {
      return {
        r: sumR / count,
        g: sumG / count,
        b: sumB / count,
      };
    }
  }

  return null;
}
