import { access } from 'node:fs/promises';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

export const ffmpegBinary = resolveBinaryPath(ffmpegStatic);
export const ffprobeBinary = resolveBinaryPath(ffprobeStatic.path);

export async function ensureBinaryAvailable(binaryPath: string, label: string): Promise<void> {
  if (!binaryPath) {
    throw new Error(`${label} binary could not be resolved.`);
  }

  await access(binaryPath);
}

function resolveBinaryPath(binaryPath: string | null | undefined): string {
  if (!binaryPath) {
    return '';
  }

  return binaryPath.replace('app.asar', 'app.asar.unpacked');
}
