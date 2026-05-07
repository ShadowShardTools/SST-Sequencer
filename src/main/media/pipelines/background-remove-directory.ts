import { mkdir } from 'node:fs/promises';
import { join, parse } from 'node:path';
import type { BackgroundRemoveModel } from '../../../shared/formats';
import { getImageFilesFromFolder } from '../discovery';
import { removeBackgroundImage } from '../background-remover';
import type { JobEmitter } from '../types';

export async function removeBackgroundFromImageDirectory(options: {
  inputDir: string;
  outputDir: string;
  model: BackgroundRemoveModel;
  emitter: JobEmitter;
  logLabel?: string;
}): Promise<void> {
  const imagePaths = await getImageFilesFromFolder(options.inputDir);
  if (imagePaths.length === 0) {
    throw new Error('No prepared image files were found for background removal.');
  }

  await mkdir(options.outputDir, { recursive: true });
  options.emitter.log(
    `Removing backgrounds from ${imagePaths.length} image(s)${
      options.logLabel ? ` in ${options.logLabel}` : ''
    } with ${options.model}.`
  );

  for (const imagePath of imagePaths) {
    await removeBackgroundImage({
      inputPath: imagePath,
      outputPath: join(options.outputDir, `${parse(imagePath).name}.png`),
      model: options.model,
      emitter: options.emitter,
    });
  }
}
