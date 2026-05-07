import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
}));

vi.mock('./discovery', () => ({
  dedupeAndSort: vi.fn((paths: string[]) => [...new Set(paths)].sort()),
  getImageFilesFromFolder: vi.fn(),
}));

import { access } from 'node:fs/promises';
import { getImageFilesFromFolder } from './discovery';
import {
  resolveBatchSequenceDirectory,
  resolveImageUpscaleDirectory,
  resolveImageUpscaleOutputPath,
  resolveSequenceInput,
  resolveSingleSequenceDirectory,
  resolveSingleSequenceOutput,
  resolveVideoUpscaleOutput,
} from './outputs';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(access).mockRejectedValue(new Error('missing'));
});

describe('media output resolution helpers', () => {
  it('resolves sequence input from direct images or a folder', async () => {
    await expect(
      resolveSequenceInput({
        kind: 'sequence-to-video',
        sourceMode: 'images',
        imagePaths: ['D:\\b.png', 'D:\\a.png', 'D:\\a.png'],
        fps: 24,
        speed: 1,
        quality: 100,
        resolutionMode: 'source',
        upscaleMode: 'off',
        alphaMode: 'auto',
        upscalerConfig: { kind: 'realesrgan', model: 'realesrgan-x4plus' },
        format: 'mp4-h264',
      })
    ).resolves.toEqual(['D:\\a.png', 'D:\\b.png']);

    vi.mocked(getImageFilesFromFolder).mockResolvedValue(['D:\\seq\\001.png']);

    await expect(
      resolveSequenceInput({
        kind: 'sequence-to-video',
        sourceMode: 'folder',
        sequenceFolder: 'D:\\seq',
        fps: 24,
        speed: 1,
        quality: 100,
        resolutionMode: 'source',
        upscaleMode: 'off',
        alphaMode: 'auto',
        upscalerConfig: { kind: 'realesrgan', model: 'realesrgan-x4plus' },
        format: 'mp4-h264',
      })
    ).resolves.toEqual(['D:\\seq\\001.png']);
  });

  it('throws when folder-based sequence input is missing', async () => {
    await expect(
      resolveSequenceInput({
        kind: 'sequence-to-video',
        sourceMode: 'folder',
        sequenceFolder: '   ',
        fps: 24,
        speed: 1,
        quality: 100,
        resolutionMode: 'source',
        upscaleMode: 'off',
        alphaMode: 'auto',
        upscalerConfig: { kind: 'realesrgan', model: 'realesrgan-x4plus' },
        format: 'mp4-h264',
      })
    ).rejects.toThrow('Select an image sequence folder or choose image files first.');
  });

  it('builds unique default sequence video outputs from the source folder', async () => {
    vi.mocked(access).mockImplementation(async (targetPath) => {
      if (targetPath === 'D:\\seq\\seq.mp4') {
        return;
      }

      throw new Error('missing');
    });

    await expect(
      resolveSingleSequenceOutput(
        {
          kind: 'sequence-to-video',
          sourceMode: 'folder',
          sequenceFolder: 'D:\\seq',
          fps: 24,
          speed: 1,
          quality: 100,
          resolutionMode: 'source',
          upscaleMode: 'off',
          alphaMode: 'auto',
          upscalerConfig: { kind: 'realesrgan', model: 'realesrgan-x4plus' },
          format: 'mp4-h264',
        },
        ['D:\\seq\\001.png']
      )
    ).resolves.toBe('D:\\seq\\seq-2.mp4');
  });

  it('creates unique default directories and output files for derived exports', async () => {
    vi.mocked(access).mockImplementation(async (targetPath) => {
      if (targetPath === 'D:\\clip_sequence' || targetPath === 'D:\\images\\upscaled_images') {
        return;
      }

      throw new Error('missing');
    });

    await expect(
      resolveSingleSequenceDirectory({
        kind: 'video-to-sequence',
        videoPath: 'D:\\clip.mov',
        fps: 24,
        speed: 1,
        quality: 100,
        resolutionMode: 'source',
        upscaleMode: 'off',
        alphaMode: 'auto',
        upscalerConfig: { kind: 'realesrgan', model: 'realesrgan-x4plus' },
        format: 'png',
        prefix: 'frame',
        startNumber: 1,
      })
    ).resolves.toBe('D:\\clip_sequence-2');

    await expect(
      resolveImageUpscaleDirectory(
        {
          kind: 'image-upscale',
          imagePaths: ['D:\\images\\sprite.png'],
          quality: 100,
          resolutionMode: 'source',
          upscaleMode: '2x',
          alphaMode: 'auto',
          upscalerConfig: { kind: 'realsr' },
          format: 'png',
        },
        ['D:\\images\\sprite.png']
      )
    ).resolves.toBe('D:\\images\\upscaled_images-2');

    await expect(resolveImageUpscaleOutputPath('D:\\out', 'D:\\images\\sprite.png', 'webp')).resolves.toBe(
      'D:\\out\\sprite.webp'
    );
  });

  it('resolves batch and video-upscale outputs with required custom roots and normalized extensions', async () => {
    await expect(
      resolveBatchSequenceDirectory(
        {
          kind: 'batch-video-to-sequence',
          sourceMode: 'files',
          videoPaths: ['D:\\clip.mov'],
          recursive: true,
          outputMode: 'custom-root',
          outputRoot: 'D:\\exports',
          overrideFps: false,
          fps: 24,
          speed: 1,
          quality: 100,
          resolutionMode: 'source',
          upscaleMode: 'off',
          alphaMode: 'auto',
          upscalerConfig: { kind: 'realesrgan', model: 'realesrgan-x4plus' },
          format: 'png',
          prefix: 'frame',
          startNumber: 1,
        },
        'D:\\clip.mov'
      )
    ).resolves.toBe('D:\\exports\\clip_sequence');

    await expect(
      resolveVideoUpscaleOutput({
        kind: 'video-upscale',
        videoPath: 'D:\\clip.mov',
        outputPath: 'D:\\exports\\clip.apng.mp4',
        quality: 100,
        resolutionMode: 'source',
        upscaleMode: '2x',
        alphaMode: 'auto',
        upscalerConfig: { kind: 'realsr' },
        format: 'apng',
      })
    ).resolves.toBe('D:\\exports\\clip.apng');
  });
});
