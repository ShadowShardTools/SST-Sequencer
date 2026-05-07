import { access } from 'node:fs/promises';
import { basename, dirname, join, parse } from 'node:path';
import { applyVideoFormatExtension, getVideoFormatExtension, type ImageFormat } from '../../shared/formats';
import type {
  BatchImageUpscaleJob,
  BatchSequenceToVideoJob,
  BatchVideoToSequenceJob,
  ImageUpscaleJob,
  SequenceToVideoJob,
  VideoUpscaleJob,
  VideoToSequenceJob,
} from '../../shared/jobs';
import { dedupeAndSort, getImageFilesFromFolder } from './discovery';

export async function resolveSequenceInput(request: SequenceToVideoJob): Promise<string[]> {
  if (request.sourceMode === 'images') {
    return dedupeAndSort(request.imagePaths ?? []);
  }

  const folderPath = request.sequenceFolder?.trim();
  if (!folderPath) {
    throw new Error('Select an image sequence folder or choose image files first.');
  }

  return getImageFilesFromFolder(folderPath);
}

export async function resolveSingleSequenceOutput(
  request: SequenceToVideoJob,
  imagePaths: string[]
): Promise<string> {
  if (request.outputPath?.trim()) {
    return applyVideoFormatExtension(request.outputPath, request.format);
  }

  const defaultDir =
    request.sourceMode === 'folder' && request.sequenceFolder
      ? request.sequenceFolder
      : dirname(imagePaths[0] ?? '');

  const baseName =
    request.sourceMode === 'folder' && request.sequenceFolder
      ? basename(request.sequenceFolder)
      : basename(defaultDir) || parse(imagePaths[0] ?? 'sequence').name || 'sequence';

  return ensureUniqueFilePath(
    join(defaultDir, `${baseName}.${getVideoFormatExtension(request.format)}`)
  );
}

export async function resolveSingleSequenceDirectory(request: VideoToSequenceJob): Promise<string> {
  if (request.outputDir?.trim()) {
    return request.outputDir;
  }

  const videoPath = request.videoPath?.trim();
  if (!videoPath) {
    throw new Error('Select a source video before choosing an output directory.');
  }

  return ensureUniqueDirectory(join(dirname(videoPath), `${parse(videoPath).name}_sequence`));
}

export async function resolveBatchSequenceDirectory(
  request: BatchVideoToSequenceJob,
  videoPath: string
): Promise<string> {
  if (request.outputMode === 'custom-root') {
    const outputRoot = request.outputRoot?.trim();
    if (!outputRoot) {
      throw new Error('Choose an output root for the batch export.');
    }

    return ensureUniqueDirectory(join(outputRoot, `${parse(videoPath).name}_sequence`));
  }

  return ensureUniqueDirectory(join(dirname(videoPath), `${parse(videoPath).name}_sequence`));
}

export async function resolveBatchVideoOutput(
  request: BatchSequenceToVideoJob,
  sequenceFolder: string
): Promise<string> {
  if (request.outputMode === 'custom-root') {
    const outputRoot = request.outputRoot?.trim();
    if (!outputRoot) {
      throw new Error('Choose an output root for the batch export.');
    }

    return ensureUniqueFilePath(
      join(outputRoot, `${basename(sequenceFolder)}.${getVideoFormatExtension(request.format)}`)
    );
  }

  return ensureUniqueFilePath(
    join(sequenceFolder, `${basename(sequenceFolder)}.${getVideoFormatExtension(request.format)}`)
  );
}

export async function resolveImageUpscaleDirectory(
  request: ImageUpscaleJob,
  imagePaths: string[]
): Promise<string> {
  if (request.outputDir?.trim()) {
    return request.outputDir;
  }

  const firstImagePath = imagePaths[0];
  if (!firstImagePath) {
    throw new Error('Select source images before choosing an output directory.');
  }

  return ensureUniqueDirectory(join(dirname(firstImagePath), 'upscaled_images'));
}

export async function resolveImageUpscaleOutputPath(
  outputDir: string,
  imagePath: string,
  format: ImageFormat
): Promise<string> {
  return ensureUniqueFilePath(join(outputDir, `${parse(imagePath).name}.${format}`));
}

export function resolveBatchImageUpscaleDirectory(
  request: BatchImageUpscaleJob,
  imagePath: string
): string {
  if (request.outputMode === 'custom-root') {
    const outputRoot = request.outputRoot?.trim();
    if (!outputRoot) {
      throw new Error('Choose an output root for the batch export.');
    }

    return outputRoot;
  }

  return join(dirname(imagePath), 'upscaled_images');
}

export async function resolveVideoUpscaleOutput(
  request: VideoUpscaleJob
): Promise<string> {
  const videoPath = request.videoPath?.trim();
  if (!videoPath) {
    throw new Error('Select a source video before choosing an output file.');
  }

  if (request.outputPath?.trim()) {
    return applyVideoFormatExtension(request.outputPath, request.format);
  }

  return ensureUniqueFilePath(
    join(dirname(videoPath), `${parse(videoPath).name}_upscaled.${getVideoFormatExtension(request.format)}`)
  );
}

export async function resolveBatchVideoUpscaleOutput(
  request: {
    outputMode: 'for-each' | 'custom-root';
    outputRoot?: string;
    format: VideoUpscaleJob['format'];
  },
  videoPath: string
): Promise<string> {
  if (request.outputMode === 'custom-root') {
    const outputRoot = request.outputRoot?.trim();
    if (!outputRoot) {
      throw new Error('Choose an output root for the batch export.');
    }

    return ensureUniqueFilePath(
      join(outputRoot, `${parse(videoPath).name}_upscaled.${getVideoFormatExtension(request.format)}`)
    );
  }

  return ensureUniqueFilePath(
    join(dirname(videoPath), `${parse(videoPath).name}_upscaled.${getVideoFormatExtension(request.format)}`)
  );
}

async function ensureUniqueFilePath(filePath: string): Promise<string> {
  const parsed = parse(filePath);
  let candidate = filePath;
  let counter = 2;

  while (await pathExists(candidate)) {
    candidate = join(parsed.dir, `${parsed.name}-${counter}${parsed.ext}`);
    counter += 1;
  }

  return candidate;
}

async function ensureUniqueDirectory(directoryPath: string): Promise<string> {
  let candidate = directoryPath;
  let counter = 2;

  while (await pathExists(candidate)) {
    candidate = `${directoryPath}-${counter}`;
    counter += 1;
  }

  return candidate;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
