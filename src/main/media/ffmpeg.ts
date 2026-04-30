import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ImageFormat, VideoFormat } from '../../shared/formats';
import { ensureBinaryAvailable, ffmpegBinary } from './binaries';
import { probeVideoDuration } from './ffprobe';
import type { JobEmitter } from './types';
import { sanitizePrefix } from './validation';

type FfmpegRunOptions = {
  args: string[];
  expectedDurationSeconds?: number;
  onProgress?: (percent: number) => void;
  emitter: JobEmitter;
};

export async function createVideoFromImages(options: {
  imagePaths: string[];
  outputPath: string;
  fps: number;
  speed: number;
  quality: number;
  format: VideoFormat;
  resize?: {
    width: number;
    height: number;
  };
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

  if (options.format === 'gif-palette') {
    const maxColors = mapQualityToGifColors(options.quality);
    args.push(
      '-filter_complex',
      `[0:v]setpts=${formatSetpts(options.speed)}*PTS,fps=${options.fps},split[frames][palette_source];` +
        `[palette_source]palettegen=max_colors=${maxColors}:stats_mode=diff[palette];` +
        '[frames][palette]paletteuse=dither=sierra2_4a',
      '-loop',
      '0',
      options.outputPath
    );
  } else if (options.format === 'apng') {
    const filterChain = [
      `setpts=${formatSetpts(options.speed)}*PTS`,
      `fps=${options.fps}`,
      ...getResizeFilter(options.resize),
      ...(options.extraVideoFilters ?? []),
      'format=rgba',
    ].join(',');

    args.push(
      '-vf',
      filterChain,
      '-plays',
      '0',
      '-compression_level',
      String(mapQualityToPngCompressionLevel(options.quality)),
      '-f',
      'apng',
      options.outputPath
    );
  } else {
    const filterChain = [
      `setpts=${formatSetpts(options.speed)}*PTS`,
      `fps=${options.fps}`,
      ...getResizeFilter(options.resize),
      'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      ...(options.extraVideoFilters ?? []),
      ...getVideoPostFilters(options.format),
    ].join(',');

    args.push(
      '-vf',
      filterChain,
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

export async function createImagesFromVideo(options: {
  videoPath: string;
  outputDir: string;
  fps: number;
  speed: number;
  quality: number;
  resize?: {
    width: number;
    height: number;
  };
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

function getResizeFilter(
  resize:
    | {
        width: number;
        height: number;
      }
    | undefined
): string[] {
  if (!resize) {
    return [];
  }

  return [`scale=${resize.width}:${resize.height}:flags=lanczos`];
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
      return ['-pix_fmt', 'rgb24'];
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
