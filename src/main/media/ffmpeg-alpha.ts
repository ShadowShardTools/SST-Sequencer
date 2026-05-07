import type { AlphaMode } from '../../shared/formats';
import { ensureBinaryAvailable, ffmpegBinary } from './binaries';
import { probeMediaInfo } from './ffprobe';
import { runFfmpeg } from './ffmpeg-runner';
import { spawnManaged } from './job-runtime';
import type { JobEmitter } from './types';

export type ResolvedAlphaMode = Exclude<AlphaMode, 'auto'>;

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
    const child = spawnManaged(
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
