import { access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
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

export function resolveRealEsrganBinary(): string {
  return resolveBundledExecutable('realesrgan', 'realesrgan-ncnn-vulkan');
}

export function resolveRealEsrganModelsDir(): string {
  return resolveBundledDirectory('realesrgan', 'models');
}

export function resolveRealcuganBinary(): string {
  return resolveBundledExecutable('realcugan', 'realcugan-ncnn-vulkan');
}

export function resolveRealcuganModelsDir(variant: 'se' | 'pro' | 'nose' = 'se'): string {
  return resolveBundledDirectory('realcugan', `models-${variant}`);
}

export function resolveWaifu2xBinary(): string {
  return resolveBundledExecutable('waifu2x', 'waifu2x-ncnn-vulkan');
}

export function resolveWaifu2xModelsDir(
  model: 'cunet' | 'anime-style-art-rgb' | 'photo' = 'cunet'
): string {
  switch (model) {
    case 'anime-style-art-rgb':
      return resolveBundledDirectory('waifu2x', 'models-upconv_7_anime_style_art_rgb');
    case 'photo':
      return resolveBundledDirectory('waifu2x', 'models-upconv_7_photo');
    case 'cunet':
    default:
      return resolveBundledDirectory('waifu2x', 'models-cunet');
  }
}

export function resolveRealSrBinary(): string {
  return resolveBundledExecutable('realsr', 'realsr-ncnn-vulkan');
}

export function resolveRealSrModelsDir(): string {
  return resolveBundledDirectory('realsr', 'models-DF2K_JPEG');
}

export function resolveSwinIrVendorDir(): string {
  return resolveBundledDirectory('swinir', '');
}

export function resolveSwinIrModelsDir(): string {
  return resolveBundledDirectory('swinir', 'models');
}

export function resolveSwinIrNetworkPath(): string {
  return resolveBundledPath('swinir', 'network_swinir.py');
}

export function resolveDatVendorDir(): string {
  return resolveBundledDirectory('dat', '');
}

export function resolveDatModelsDir(): string {
  return resolveBundledDirectory('dat', 'models');
}

export function resolveDatArchPath(): string {
  return resolveBundledPath('dat', 'dat_arch.py');
}

export function resolveAnime4kcppBinary(): string {
  return resolveBundledExecutable('anime4kcpp', 'ac_cli');
}

function resolveBundledExecutable(resourceFolder: string, executableBaseName: string): string {
  const executableName =
    process.platform === 'win32' ? `${executableBaseName}.exe` : executableBaseName;
  return resolveBundledPath(resourceFolder, executableName);
}

function resolveBundledDirectory(resourceFolder: string, directoryName: string): string {
  if (!directoryName) {
    return resolveBundledPath(resourceFolder, '');
  }
  return resolveBundledPath(resourceFolder, directoryName);
}

function resolveBundledPath(resourceFolder: string, entryName: string): string {
  const candidates = [
    join(process.resourcesPath, resourceFolder, entryName),
    join(process.cwd(), 'vendor', resourceFolder, entryName),
  ];

  const resolved = candidates.find((candidate) => existsSync(candidate));
  return resolved ? resolved.replace('app.asar', 'app.asar.unpacked') : '';
}
