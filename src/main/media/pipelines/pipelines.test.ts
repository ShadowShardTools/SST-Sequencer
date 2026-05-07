import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobEmitter } from '../types';

vi.mock('node:fs/promises', () => ({
  mkdtemp: vi.fn(),
  rm: vi.fn(),
}));

vi.mock('node:os', () => ({
  tmpdir: vi.fn(() => 'D:\\tmp'),
}));

vi.mock('../ffmpeg', () => ({
  createImagesFromImageSequence: vi.fn(),
  createImagesFromVideo: vi.fn(),
}));

vi.mock('../ffprobe', () => ({
  probeMediaInfo: vi.fn(),
}));

vi.mock('../discovery', () => ({
  getImageFilesFromFolder: vi.fn(),
}));

vi.mock('../anime4kcpp', () => ({
  upscaleImageDirectory: vi.fn(),
}));

vi.mock('../dat', () => ({
  upscaleImageDirectory: vi.fn(),
}));

vi.mock('../pixel-scale-epx', () => ({
  upscaleImageDirectory: vi.fn(),
}));

vi.mock('../realcugan', () => ({
  upscaleImageDirectory: vi.fn(),
}));

vi.mock('../realesrgan', () => ({
  upscaleImageDirectory: vi.fn(),
}));

vi.mock('../realsr', () => ({
  upscaleImageDirectory: vi.fn(),
}));

vi.mock('../swinir', () => ({
  upscaleImageDirectory: vi.fn(),
}));

vi.mock('../waifu2x', () => ({
  upscaleImageDirectory: vi.fn(),
}));

vi.mock('../xbr-js', () => ({
  upscaleImageDirectory: vi.fn(),
}));

vi.mock('../../jobs/job-helpers', async () => {
  const actual = await vi.importActual('../../jobs/job-helpers');

  return {
    ...(actual as object),
    removeTemporaryDirectories: vi.fn(),
  };
});

import { mkdtemp, rm } from 'node:fs/promises';
import { createImagesFromImageSequence, createImagesFromVideo } from '../ffmpeg';
import { probeMediaInfo } from '../ffprobe';
import { getImageFilesFromFolder } from '../discovery';
import { upscaleImageDirectory as upscaleWithRealcugan } from '../realcugan';
import { removeTemporaryDirectories } from '../../jobs/job-helpers';
import { upscaleFrameDirectory } from './upscale-frame-directory';
import { prepareSequenceFramesForOutput } from './upscale-sequence-directory';
import {
  createImageSequenceFromVideoWithUpscale,
  extractVideoFramesForVideoUpscale,
} from './upscale-video-via-frames';

function createEmitter(): JobEmitter {
  return {
    started: vi.fn(),
    log: vi.fn(),
    progress: vi.fn(),
    finished: vi.fn(),
  };
}

const backgroundRemoveDefaults = {
  backgroundRemove: false,
  backgroundRemoveModel: 'u2net' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('media pipelines', () => {
  it('composes non-native 6x frame upscales into multiple passes and cleans temp dirs', async () => {
    const emitter = createEmitter();

    vi.mocked(mkdtemp).mockResolvedValueOnce('D:\\tmp\\pass-1');
    vi.mocked(upscaleWithRealcugan).mockResolvedValue(undefined);
    vi.mocked(rm).mockResolvedValue(undefined);

    await upscaleFrameDirectory({
      upscalerConfig: { kind: 'realcugan', variant: 'no-denoise' },
      inputDir: 'D:\\input',
      outputDir: 'D:\\output',
      scale: 6,
      preserveAlpha: true,
      alphaMode: 'auto',
      emitter,
    });

    expect(emitter.log).toHaveBeenCalledWith(
      'Composing 6x Real-CUGAN upscale using 3x then 2x passes.'
    );
    expect(upscaleWithRealcugan).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        inputDir: 'D:\\input',
        outputDir: 'D:\\tmp\\pass-1',
        scale: 3,
        realcuganVariant: 'no-denoise',
      })
    );
    expect(upscaleWithRealcugan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        inputDir: 'D:\\tmp\\pass-1',
        outputDir: 'D:\\output',
        scale: 2,
        realcuganVariant: 'no-denoise',
      })
    );
    expect(rm).toHaveBeenCalledWith('D:\\tmp\\pass-1', {
      recursive: true,
      force: true,
    });
  });

  it('prepares sequence frames through the shared upscale pipeline and exposes cleanup', async () => {
    const emitter = createEmitter();

    vi.mocked(probeMediaInfo).mockResolvedValue({
      width: 320,
      height: 180,
      hasAlpha: true,
    });
    vi.mocked(mkdtemp)
      .mockResolvedValueOnce('D:\\tmp\\base')
      .mockResolvedValueOnce('D:\\tmp\\upscaled');
    vi.mocked(createImagesFromImageSequence).mockResolvedValue(undefined);
    vi.mocked(upscaleWithRealcugan).mockResolvedValue(undefined);
    vi.mocked(getImageFilesFromFolder).mockResolvedValue(['D:\\tmp\\upscaled\\frame-0001.png']);
    vi.mocked(removeTemporaryDirectories).mockResolvedValue(undefined);

    const result = await prepareSequenceFramesForOutput({
      imagePaths: ['D:\\frames\\0001.png'],
      resize: { width: 640, height: 360 },
      upscaleMode: '2x',
      upscalerConfig: { kind: 'realcugan', variant: 'denoise' },
      alphaMode: 'premultiplied',
      ...backgroundRemoveDefaults,
      emitter,
      logLabel: 'test-sequence',
    });

    expect(createImagesFromImageSequence).toHaveBeenCalledWith(
      expect.objectContaining({
        imagePaths: ['D:\\frames\\0001.png'],
        outputDir: 'D:\\tmp\\base',
        format: 'png',
        quality: 100,
        prefix: 'frame',
        startNumber: 1,
        resize: { width: 640, height: 360 },
      })
    );
    expect(upscaleWithRealcugan).toHaveBeenCalledWith(
      expect.objectContaining({
        inputDir: 'D:\\tmp\\base',
        outputDir: 'D:\\tmp\\upscaled',
        scale: 2,
        preserveAlpha: true,
        alphaMode: 'premultiplied',
        realcuganVariant: 'denoise',
      })
    );
    expect(result).toEqual({
      imagePaths: ['D:\\tmp\\upscaled\\frame-0001.png'],
      resize: undefined,
      cleanup: expect.any(Function),
    });

    await result.cleanup();

    expect(removeTemporaryDirectories).toHaveBeenCalledWith(
      'D:\\tmp\\base',
      'D:\\tmp\\upscaled'
    );
  });

  it('extracts video frames directly for nearest upscale with resized neighbor output', async () => {
    const emitter = createEmitter();

    vi.mocked(probeMediaInfo).mockResolvedValue({
      width: 200,
      height: 100,
      hasAlpha: false,
    });
    vi.mocked(mkdtemp).mockResolvedValueOnce('D:\\tmp\\video-base');
    vi.mocked(createImagesFromVideo).mockResolvedValue(undefined);
    vi.mocked(getImageFilesFromFolder).mockResolvedValue(['D:\\tmp\\video-base\\frame-0001.png']);
    vi.mocked(removeTemporaryDirectories).mockResolvedValue(undefined);

    const result = await extractVideoFramesForVideoUpscale({
      videoPath: 'D:\\clip.mov',
      sourceFps: 30,
      resize: { width: 400, height: 200 },
      upscaleMode: '2x',
      upscalerConfig: { kind: 'nearest' },
      alphaMode: 'auto',
      ...backgroundRemoveDefaults,
      emitter,
    });

    expect(createImagesFromVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        videoPath: 'D:\\clip.mov',
        outputDir: 'D:\\tmp\\video-base',
        fps: 30,
        resize: { width: 800, height: 400, flags: 'neighbor' },
        format: 'png',
      })
    );
    expect(result.imagePaths).toEqual(['D:\\tmp\\video-base\\frame-0001.png']);

    await result.cleanup();

    expect(removeTemporaryDirectories).toHaveBeenCalledWith('D:\\tmp\\video-base');
  });

  it('runs video-to-sequence upscale through extracted PNG frames and removes temp dirs', async () => {
    const emitter = createEmitter();

    vi.mocked(probeMediaInfo).mockResolvedValue({
      width: 320,
      height: 180,
      hasAlpha: true,
    });
    vi.mocked(mkdtemp)
      .mockResolvedValueOnce('D:\\tmp\\video-base')
      .mockResolvedValueOnce('D:\\tmp\\video-upscaled');
    vi.mocked(createImagesFromVideo).mockResolvedValue(undefined);
    vi.mocked(upscaleWithRealcugan).mockResolvedValue(undefined);
    vi.mocked(getImageFilesFromFolder).mockResolvedValue([
      'D:\\tmp\\video-upscaled\\frame-0001.png',
      'D:\\tmp\\video-upscaled\\frame-0002.png',
    ]);
    vi.mocked(createImagesFromImageSequence).mockResolvedValue(undefined);
    vi.mocked(removeTemporaryDirectories).mockResolvedValue(undefined);

    await createImageSequenceFromVideoWithUpscale({
      videoPath: 'D:\\clip.mov',
      outputDir: 'D:\\out',
      fps: 24,
      speed: 1,
      quality: 90,
      resize: { width: 640, height: 360 },
      format: 'png',
      prefix: 'frame',
      startNumber: 1,
      upscaleMode: '2x',
      upscalerConfig: { kind: 'realcugan', variant: 'conservative' },
      alphaMode: 'straight',
      ...backgroundRemoveDefaults,
      emitter,
    });

    expect(createImagesFromVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        videoPath: 'D:\\clip.mov',
        outputDir: 'D:\\tmp\\video-base',
        fps: 24,
        speed: 1,
        quality: 100,
        resize: { width: 640, height: 360 },
        format: 'png',
      })
    );
    expect(upscaleWithRealcugan).toHaveBeenCalledWith(
      expect.objectContaining({
        inputDir: 'D:\\tmp\\video-base',
        outputDir: 'D:\\tmp\\video-upscaled',
        scale: 2,
        preserveAlpha: true,
        alphaMode: 'straight',
        realcuganVariant: 'conservative',
      })
    );
    expect(createImagesFromImageSequence).toHaveBeenCalledWith(
      expect.objectContaining({
        imagePaths: [
          'D:\\tmp\\video-upscaled\\frame-0001.png',
          'D:\\tmp\\video-upscaled\\frame-0002.png',
        ],
        outputDir: 'D:\\out',
        format: 'png',
        quality: 90,
        prefix: 'frame',
        startNumber: 1,
      })
    );
    expect(removeTemporaryDirectories).toHaveBeenCalledWith(
      'D:\\tmp\\video-base',
      'D:\\tmp\\video-upscaled'
    );
  });
});
