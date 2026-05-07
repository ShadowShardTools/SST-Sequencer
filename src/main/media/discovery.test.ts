import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverImageFiles, discoverSequenceFolders, discoverVideoFiles } from './discovery';

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe('media discovery helpers', () => {
  it('skips app-generated output folders and upscaled video files during recursive scans', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sst-discovery-'));
    createdRoots.push(root);

    const sourceImagesDir = join(root, 'sprites');
    const sourceSequenceDir = join(root, 'walk');
    const generatedImagesDir = join(root, 'upscaled_images');
    const generatedSequenceDir = join(root, 'clip_sequence');
    const nestedSourceDir = join(root, 'nested');
    const nestedGeneratedDir = join(nestedSourceDir, 'upscaled_images');

    await Promise.all([
      mkdir(sourceImagesDir, { recursive: true }),
      mkdir(sourceSequenceDir, { recursive: true }),
      mkdir(generatedImagesDir, { recursive: true }),
      mkdir(generatedSequenceDir, { recursive: true }),
      mkdir(nestedSourceDir, { recursive: true }),
      mkdir(nestedGeneratedDir, { recursive: true }),
    ]);

    await Promise.all([
      writeFile(join(sourceImagesDir, 'sprite.png'), ''),
      writeFile(join(sourceSequenceDir, '001.png'), ''),
      writeFile(join(root, 'clip.mov'), ''),
      writeFile(join(root, 'clip_upscaled.mov'), ''),
      writeFile(join(generatedImagesDir, 'sprite.png'), ''),
      writeFile(join(generatedSequenceDir, '001.png'), ''),
      writeFile(join(nestedSourceDir, 'nested.mov'), ''),
      writeFile(join(nestedSourceDir, 'nested_upscaled.mov'), ''),
      writeFile(join(nestedGeneratedDir, 'nested.png'), ''),
    ]);

    const imageFiles = await discoverImageFiles(root, true);
    const videoFiles = await discoverVideoFiles(root, true);
    const sequenceFolders = await discoverSequenceFolders(root, true);

    expect(imageFiles.map((path) => relative(root, path))).toEqual([
      join('walk', '001.png'),
      join('sprites', 'sprite.png'),
    ]);

    expect(videoFiles.map((path) => relative(root, path))).toEqual([
      'clip.mov',
      join('nested', 'nested.mov'),
    ]);

    expect(sequenceFolders.map((path) => relative(root, path))).toEqual(['sprites', 'walk']);
  });

  it('still allows explicitly scanning a generated output folder when it is the chosen root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sst-discovery-root-'));
    createdRoots.push(root);

    const generatedImagesDir = join(root, 'upscaled_images');
    const generatedSequenceDir = join(root, 'clip_sequence');

    await Promise.all([
      mkdir(generatedImagesDir, { recursive: true }),
      mkdir(generatedSequenceDir, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(generatedImagesDir, 'sprite.png'), ''),
      writeFile(join(generatedSequenceDir, '001.png'), ''),
    ]);

    await expect(discoverImageFiles(generatedImagesDir, true)).resolves.toEqual([
      join(generatedImagesDir, 'sprite.png'),
    ]);
    await expect(discoverSequenceFolders(generatedSequenceDir, true)).resolves.toEqual([
      generatedSequenceDir,
    ]);
  });
});
