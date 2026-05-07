import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ImageFormat, VideoFormat } from '../../shared/formats';
import { runFfmpeg } from './ffmpeg-runner';
import { getResizeFilter, type ResizeOptions } from './ffmpeg-resize';
import type { JobEmitter } from './types';

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
  audioSourcePath?: string;
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
  if (options.audioSourcePath?.trim()) {
    args.push('-i', options.audioSourcePath);
  }
  const filterSpec = buildSequenceToVideoFilterSpec({
    fps: options.fps,
    speed: options.speed,
    quality: options.quality,
    format: options.format,
    resize: options.resize,
    extraVideoFilters: options.extraVideoFilters,
  });

  if (options.format === 'gif-palette') {
    args.push(filterSpec.argument, filterSpec.value, '-loop', '0', options.outputPath);
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
    args.push('-map', '0:v:0');
    if (options.audioSourcePath?.trim()) {
      args.push('-map', '1:a?');
    }
    args.push(
      filterSpec.argument,
      filterSpec.value,
      ...getVideoCodecArgs(options.format, options.quality),
      ...getAudioCodecArgs(options.format, Boolean(options.audioSourcePath?.trim())),
      ...(options.audioSourcePath?.trim() ? ['-shortest'] : []),
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
    value: [
      ...baseFilters,
      'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      ...getVideoPostFilters(options.format),
    ].join(','),
  };
}

export async function convertStillImage(options: {
  inputPath: string;
  outputPath: string;
  format: ImageFormat;
  quality: number;
  resize?: ResizeOptions;
  emitter: JobEmitter;
}): Promise<void> {
  const filterChain = [...getResizeFilter(options.resize)].join(',');
  const args = ['-hide_banner', '-y', '-i', options.inputPath, '-frames:v', '1'];

  if (filterChain) {
    args.push('-vf', filterChain);
  }

  args.push(...getImageCodecArgs(options.format, options.quality), options.outputPath);

  await runFfmpeg({
    args,
    emitter: options.emitter,
  });
}

export function getImageCodecArgs(format: ImageFormat, quality: number): string[] {
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

function getAudioCodecArgs(format: VideoFormat, includeAudio: boolean): string[] {
  if (!includeAudio) {
    return [];
  }

  if (format === 'webm-vp9') {
    return ['-c:a', 'libopus', '-b:a', '160k'];
  }

  return ['-c:a', 'aac', '-b:a', '192k'];
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeForConcat(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/'/g, "'\\''");
}
