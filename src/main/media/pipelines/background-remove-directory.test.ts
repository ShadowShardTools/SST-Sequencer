import type * as FsPromises from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof FsPromises>('node:fs/promises');
  return {
    ...actual,
    mkdir: vi.fn(),
  };
});

vi.mock('../discovery', () => ({
  getImageFilesFromFolder: vi.fn(),
}));

vi.mock('../background-remover', () => ({
  removeBackgroundImage: vi.fn(),
}));

import { mkdir } from 'node:fs/promises';
import { getImageFilesFromFolder } from '../discovery';
import { removeBackgroundImage } from '../background-remover';
import { removeBackgroundFromImageDirectory } from './background-remove-directory';

function createEmitter() {
  return {
    started: vi.fn(),
    log: vi.fn(),
    progress: vi.fn(),
    finished: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('background remove directory pipeline', () => {
  it('fails when the prepared directory contains no images', async () => {
    vi.mocked(getImageFilesFromFolder).mockResolvedValue([]);

    await expect(
      removeBackgroundFromImageDirectory({
        inputDir: 'D:\\prepared',
        outputDir: 'D:\\output',
        model: 'u2net',
        emitter: createEmitter(),
      })
    ).rejects.toThrow('No prepared image files were found for background removal.');
  });

  it('logs the operation and writes PNG outputs per source image', async () => {
    const emitter = createEmitter();
    vi.mocked(getImageFilesFromFolder).mockResolvedValue([
      'D:\\prepared\\walk 01.jpg',
      'D:\\prepared\\run 02.webp',
    ]);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(removeBackgroundImage).mockResolvedValue(undefined);

    await removeBackgroundFromImageDirectory({
      inputDir: 'D:\\prepared',
      outputDir: 'D:\\cutout',
      model: 'isnet-anime',
      emitter,
      logLabel: 'batch-1',
    });

    expect(mkdir).toHaveBeenCalledWith('D:\\cutout', { recursive: true });
    expect(emitter.log).toHaveBeenCalledWith(
      'Removing backgrounds from 2 image(s) in batch-1 with isnet-anime.'
    );
    expect(removeBackgroundImage).toHaveBeenNthCalledWith(1, {
      inputPath: 'D:\\prepared\\walk 01.jpg',
      outputPath: 'D:\\cutout\\walk 01.png',
      model: 'isnet-anime',
      emitter,
    });
    expect(removeBackgroundImage).toHaveBeenNthCalledWith(2, {
      inputPath: 'D:\\prepared\\run 02.webp',
      outputPath: 'D:\\cutout\\run 02.png',
      model: 'isnet-anime',
      emitter,
    });
  });
});
