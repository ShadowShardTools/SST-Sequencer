import { runFfmpeg } from './ffmpeg-runner';
import type { JobEmitter } from './types';

export type ResizeOptions = {
  width: number;
  height: number;
  flags?: 'lanczos' | 'neighbor' | 'bilinear';
};

export function getResizeFilter(resize: ResizeOptions | undefined): string[] {
  if (!resize) {
    return [];
  }

  return [`scale=${resize.width}:${resize.height}:flags=${resize.flags ?? 'lanczos'}`];
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
