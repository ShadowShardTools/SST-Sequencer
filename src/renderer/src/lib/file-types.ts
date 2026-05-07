import { getExtension } from './path-utils';

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
  '.tga',
  '.exr',
]);
const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.mxf',
  '.webm',
  '.m4v',
  '.gif',
  '.apng',
]);
const DISPLAYABLE_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.gif',
  '.apng',
]);

export function isImagePath(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(filePath));
}

export function isVideoPath(filePath: string): boolean {
  return VIDEO_EXTENSIONS.has(getExtension(filePath));
}

export function isDisplayableImagePath(filePath: string): boolean {
  return DISPLAYABLE_IMAGE_EXTENSIONS.has(getExtension(filePath));
}
