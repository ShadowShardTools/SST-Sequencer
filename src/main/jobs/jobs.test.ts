import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BatchImageUpscaleJob,
  BatchSequenceToVideoJob,
  BatchVideoToSequenceJob,
  BatchVideoUpscaleJob,
  SequenceToVideoJob,
  VideoUpscaleJob,
} from '../../shared/jobs';
import type { JobEmitter } from '../media/types';
import { runBatchImageUpscaleJob } from './batch-image-upscale';
import { runBatchSequenceToVideoJob } from './batch-sequence-to-video';
import { runBatchVideoUpscaleJob } from './batch-video-upscale';
import { runBatchVideoToSequenceJob } from './batch-video-to-sequence';
import { buildBatchSummary } from './job-helpers';
import { runSequenceToVideoJob } from './sequence-to-video';
import { runVideoUpscaleJob } from './video-upscale';

vi.mock('../media/ffmpeg', () => ({
  createVideoFromImages: vi.fn(),
  convertStillImage: vi.fn(),
}));

vi.mock('../media/outputs', () => ({
  resolveBatchImageUpscaleDirectory: vi.fn(),
  resolveBatchVideoOutput: vi.fn(),
  resolveBatchVideoUpscaleOutput: vi.fn(),
  resolveImageUpscaleDirectory: vi.fn(),
  resolveImageUpscaleOutputPath: vi.fn(),
  resolveSingleSequenceOutput: vi.fn(),
  resolveSequenceInput: vi.fn(),
  resolveBatchSequenceDirectory: vi.fn(),
  resolveVideoUpscaleOutput: vi.fn(),
}));

vi.mock('../media/resize', () => ({
  resolveImageResizeTarget: vi.fn(),
  resolveSequenceResizeTarget: vi.fn(),
  resolveVideoResizeTarget: vi.fn(),
}));

vi.mock('../media/pipelines/upscale-sequence-directory', () => ({
  prepareSequenceFramesForOutput: vi.fn(),
}));

vi.mock('../media/pipelines/upscale-video-via-frames', () => ({
  createImageSequenceFromVideoWithUpscale: vi.fn(),
  extractVideoFramesForVideoUpscale: vi.fn(),
}));

vi.mock('../media/ffprobe', () => ({
  probeMediaInfo: vi.fn(),
}));

vi.mock('../media/discovery', () => ({
  dedupeAndSort: vi.fn((paths: string[]) => [...new Set(paths)].sort()),
  discoverSequenceFolders: vi.fn(),
  discoverVideoFiles: vi.fn(),
  getImageFilesFromFolder: vi.fn(),
}));

import { convertStillImage, createVideoFromImages } from '../media/ffmpeg';
import {
  resolveBatchImageUpscaleDirectory,
  resolveBatchVideoOutput,
  resolveBatchVideoUpscaleOutput,
  resolveImageUpscaleDirectory,
  resolveImageUpscaleOutputPath,
  resolveBatchSequenceDirectory,
  resolveSequenceInput,
  resolveSingleSequenceOutput,
  resolveVideoUpscaleOutput,
} from '../media/outputs';
import { probeMediaInfo } from '../media/ffprobe';
import { getImageFilesFromFolder } from '../media/discovery';
import {
  createImageSequenceFromVideoWithUpscale,
  extractVideoFramesForVideoUpscale,
} from '../media/pipelines/upscale-video-via-frames';
import { prepareSequenceFramesForOutput } from '../media/pipelines/upscale-sequence-directory';
import {
  resolveImageResizeTarget,
  resolveSequenceResizeTarget,
  resolveVideoResizeTarget,
} from '../media/resize';

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

function createSequenceToVideoJob(): SequenceToVideoJob {
  return {
    kind: 'sequence-to-video',
    sourceMode: 'folder',
    sequenceFolder: 'D:\\frames',
    imagePaths: [],
    outputPath: '',
    fps: 24,
    speed: 1,
    quality: 100,
    ...backgroundRemoveDefaults,
    resolutionMode: 'source',
    customWidth: 1920,
    customHeight: 1080,
    upscaleMode: 'off',
    alphaMode: 'auto',
    upscalerConfig: { kind: 'realesrgan', model: 'realesrgan-x4plus' },
    format: 'mp4-h264',
  };
}

function createBatchVideoToSequenceJob(): BatchVideoToSequenceJob {
  return {
    kind: 'batch-video-to-sequence',
    sourceMode: 'files',
    videoPaths: ['D:\\a.mp4', 'D:\\b.mp4'],
    scanRoot: '',
    recursive: true,
    outputMode: 'for-each',
    outputRoot: '',
    overrideFps: true,
    fps: 24,
    speed: 1,
    quality: 100,
    ...backgroundRemoveDefaults,
    resolutionMode: 'source',
    customWidth: 1920,
    customHeight: 1080,
    upscaleMode: 'off',
    alphaMode: 'auto',
    upscalerConfig: { kind: 'realesrgan', model: 'realesrgan-x4plus' },
    format: 'png',
    prefix: 'frame',
    startNumber: 1,
  };
}

function createBatchImageUpscaleJob(): BatchImageUpscaleJob {
  return {
    kind: 'batch-image-upscale',
    sourceMode: 'files',
    imagePaths: ['D:\\sprite.png'],
    scanRoot: '',
    recursive: true,
    outputMode: 'for-each',
    outputRoot: '',
    quality: 100,
    ...backgroundRemoveDefaults,
    resolutionMode: 'source',
    customWidth: 1920,
    customHeight: 1080,
    upscaleMode: '2x',
    alphaMode: 'auto',
    upscalerConfig: { kind: 'realsr' },
    format: 'png',
  };
}

function createBatchVideoUpscaleJob(): BatchVideoUpscaleJob {
  return {
    kind: 'batch-video-upscale',
    sourceMode: 'files',
    videoPaths: ['D:\\clip.mov'],
    scanRoot: '',
    recursive: true,
    outputMode: 'for-each',
    outputRoot: '',
    quality: 100,
    ...backgroundRemoveDefaults,
    resolutionMode: 'source',
    customWidth: 1920,
    customHeight: 1080,
    upscaleMode: '2x',
    alphaMode: 'auto',
    upscalerConfig: { kind: 'realesrgan', model: 'realesrgan-x4plus' },
    format: 'mp4-h264',
  };
}

function createBatchSequenceToVideoJob(): BatchSequenceToVideoJob {
  return {
    kind: 'batch-sequence-to-video',
    sourceMode: 'folders',
    sequenceFolders: ['D:\\seq-a', 'D:\\seq-b'],
    scanRoot: '',
    recursive: true,
    outputMode: 'for-each',
    outputRoot: '',
    fps: 24,
    speed: 1,
    quality: 100,
    ...backgroundRemoveDefaults,
    resolutionMode: 'source',
    customWidth: 1920,
    customHeight: 1080,
    upscaleMode: 'off',
    alphaMode: 'auto',
    upscalerConfig: { kind: 'realesrgan', model: 'realesrgan-x4plus' },
    format: 'mp4-h264',
  };
}

function createVideoUpscaleJob(): VideoUpscaleJob {
  return {
    kind: 'video-upscale',
    videoPath: 'D:\\clip.mov',
    outputPath: '',
    quality: 100,
    ...backgroundRemoveDefaults,
    resolutionMode: 'source',
    customWidth: 1920,
    customHeight: 1080,
    upscaleMode: '2x',
    alphaMode: 'auto',
    upscalerConfig: { kind: 'realesrgan', model: 'realesrgan-x4plus' },
    format: 'mp4-h264',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('main job runners', () => {
  it('surfaces the concrete failure reason when no items succeed', () => {
    expect(
      buildBatchSummary(
        [],
        [{ source: 'D:\\sprite.png', reason: 'DAT did not write any output images.' }],
        'Image upscale finished',
        'No images were upscaled.'
      )
    ).toEqual({
      headline: 'DAT did not write any output images.',
      outputs: [],
      completed: 0,
      failed: 1,
      failures: [{ source: 'D:\\sprite.png', reason: 'DAT did not write any output images.' }],
    });
  });

  it('runs sequence-to-video through prepared frames and returns a summary', async () => {
    const emitter = createEmitter();
    const cleanup = vi.fn().mockResolvedValue(undefined);

    vi.mocked(resolveSequenceInput).mockResolvedValue(['D:\\frames\\001.png', 'D:\\frames\\002.png']);
    vi.mocked(resolveSequenceResizeTarget).mockResolvedValue({ width: 640, height: 360 });
    vi.mocked(resolveSingleSequenceOutput).mockResolvedValue('D:\\out\\clip.mp4');
    vi.mocked(prepareSequenceFramesForOutput).mockResolvedValue({
      imagePaths: ['D:\\temp\\001.png', 'D:\\temp\\002.png'],
      resize: { width: 640, height: 360 },
      cleanup,
    });
    vi.mocked(createVideoFromImages).mockImplementation(async (options) => {
      options.onProgress?.(25);
    });

    const summary = await runSequenceToVideoJob(createSequenceToVideoJob(), emitter);

    expect(createVideoFromImages).toHaveBeenCalledWith(
      expect.objectContaining({
        imagePaths: ['D:\\temp\\001.png', 'D:\\temp\\002.png'],
        outputPath: 'D:\\out\\clip.mp4',
        fps: 24,
        speed: 1,
        quality: 100,
        format: 'mp4-h264',
        resize: { width: 640, height: 360 },
      })
    );
    expect(emitter.log).toHaveBeenCalledWith('Encoding 2 frames into clip.mp4.');
    expect(emitter.progress).toHaveBeenCalledWith(
      25,
      'Encoding clip.mp4',
      expect.objectContaining({
        currentItem: 'clip.mp4',
        overallIndex: 1,
        overallTotal: 1,
      })
    );
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({
      headline: 'Created video: D:\\out\\clip.mp4',
      outputs: ['D:\\out\\clip.mp4'],
      completed: 1,
      failed: 0,
      failures: [],
    });
  });

  it('always cleans up prepared sequence frames when encoding fails', async () => {
    const emitter = createEmitter();
    const cleanup = vi.fn().mockResolvedValue(undefined);

    vi.mocked(resolveSequenceInput).mockResolvedValue(['D:\\frames\\001.png']);
    vi.mocked(resolveSequenceResizeTarget).mockResolvedValue({ width: 320, height: 180 });
    vi.mocked(resolveSingleSequenceOutput).mockResolvedValue('D:\\out\\clip.mp4');
    vi.mocked(prepareSequenceFramesForOutput).mockResolvedValue({
      imagePaths: ['D:\\temp\\001.png'],
      resize: { width: 320, height: 180 },
      cleanup,
    });
    vi.mocked(createVideoFromImages).mockRejectedValue(new Error('encode failed'));

    await expect(runSequenceToVideoJob(createSequenceToVideoJob(), emitter)).rejects.toThrow(
      'encode failed'
    );
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('runs video-upscale with extracted frames, source audio, and FPS fallback', async () => {
    const emitter = createEmitter();
    const cleanup = vi.fn().mockResolvedValue(undefined);

    vi.mocked(resolveVideoUpscaleOutput).mockResolvedValue('D:\\out\\clip-upscaled.mp4');
    vi.mocked(probeMediaInfo).mockResolvedValue({
      width: 1920,
      height: 1080,
      frameRate: undefined,
      durationSeconds: 1,
      hasAlpha: false,
    });
    vi.mocked(resolveVideoResizeTarget).mockResolvedValue({ width: 960, height: 540 });
    vi.mocked(extractVideoFramesForVideoUpscale).mockResolvedValue({
      imagePaths: ['D:\\temp\\0001.png'],
      cleanup,
    });
    vi.mocked(createVideoFromImages).mockImplementation(async (options) => {
      options.onProgress?.(50);
    });

    const summary = await runVideoUpscaleJob(createVideoUpscaleJob(), emitter);

    expect(extractVideoFramesForVideoUpscale).toHaveBeenCalledWith(
      expect.objectContaining({
        videoPath: 'D:\\clip.mov',
        sourceFps: 24,
        resize: { width: 960, height: 540 },
      })
    );
    expect(createVideoFromImages).toHaveBeenCalledWith(
      expect.objectContaining({
        imagePaths: ['D:\\temp\\0001.png'],
        outputPath: 'D:\\out\\clip-upscaled.mp4',
        fps: 24,
        speed: 1,
        quality: 100,
        format: 'mp4-h264',
        audioSourcePath: 'D:\\clip.mov',
      })
    );
    expect(emitter.progress).toHaveBeenCalledWith(
      75,
      'Encoding clip-upscaled.mp4',
      expect.objectContaining({
        currentItem: 'clip-upscaled.mp4',
      })
    );
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(summary.outputs).toEqual(['D:\\out\\clip-upscaled.mp4']);
  });

  it('continues batch video-to-sequence work after per-item failures and summarizes them', async () => {
    const emitter = createEmitter();
    const request = createBatchVideoToSequenceJob();

    vi.mocked(resolveBatchSequenceDirectory)
      .mockResolvedValueOnce('D:\\out\\a')
      .mockResolvedValueOnce('D:\\out\\b');
    vi.mocked(resolveVideoResizeTarget).mockResolvedValue({ width: 640, height: 360 });
    vi.mocked(createImageSequenceFromVideoWithUpscale)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('decode failed'));

    const summary = await runBatchVideoToSequenceJob(request, emitter);

    expect(createImageSequenceFromVideoWithUpscale).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({
      headline: 'Batch video-to-sequence finished. Completed 1, failed 1.',
      outputs: ['D:\\out\\a'],
      completed: 1,
      failed: 1,
      failures: [
        {
          source: 'D:\\b.mp4',
          reason: 'decode failed',
        },
      ],
    });
    expect(emitter.log).toHaveBeenCalledWith(
      'Failed b.mp4: decode failed',
      'error'
    );
  });

  it('passes enabled upscale settings through batch video-to-sequence jobs', async () => {
    const emitter = createEmitter();
    const request: BatchVideoToSequenceJob = {
      ...createBatchVideoToSequenceJob(),
      videoPaths: ['D:\\clip.mp4'],
      upscaleMode: '2x',
      alphaMode: 'premultiplied',
      upscalerConfig: { kind: 'realcugan', variant: 'conservative' },
    };

    vi.mocked(resolveBatchSequenceDirectory).mockResolvedValue('D:\\out\\clip');
    vi.mocked(resolveVideoResizeTarget).mockResolvedValue({ width: 640, height: 360 });
    vi.mocked(createImageSequenceFromVideoWithUpscale).mockResolvedValue(undefined);

    const summary = await runBatchVideoToSequenceJob(request, emitter);

    expect(createImageSequenceFromVideoWithUpscale).toHaveBeenCalledWith(
      expect.objectContaining({
        videoPath: 'D:\\clip.mp4',
        outputDir: 'D:\\out\\clip',
        fps: 24,
        speed: 1,
        quality: 100,
        resize: { width: 640, height: 360 },
        format: 'png',
        prefix: 'frame',
        startNumber: 1,
        upscaleMode: '2x',
        upscalerConfig: { kind: 'realcugan', variant: 'conservative' },
        alphaMode: 'premultiplied',
      })
    );
    expect(summary).toEqual({
      headline: 'Batch video-to-sequence finished. Completed 1, failed 0.',
      outputs: ['D:\\out\\clip'],
      completed: 1,
      failed: 0,
      failures: [],
    });
  });

  it('passes enabled upscale settings through batch sequence-to-video jobs and cleans prepared frames', async () => {
    const emitter = createEmitter();
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const request: BatchSequenceToVideoJob = {
      ...createBatchSequenceToVideoJob(),
      sequenceFolders: ['D:\\seq-a'],
      upscaleMode: '2x',
      alphaMode: 'straight',
      upscalerConfig: { kind: 'realcugan', variant: 'denoise' },
    };

    vi.mocked(getImageFilesFromFolder).mockResolvedValue(['D:\\seq-a\\001.png', 'D:\\seq-a\\002.png']);
    vi.mocked(resolveBatchVideoOutput).mockResolvedValue('D:\\seq-a\\seq-a.mp4');
    vi.mocked(resolveSequenceResizeTarget).mockResolvedValue({ width: 640, height: 360 });
    vi.mocked(prepareSequenceFramesForOutput).mockResolvedValue({
      imagePaths: ['D:\\temp\\001.png', 'D:\\temp\\002.png'],
      resize: undefined,
      cleanup,
    });
    vi.mocked(createVideoFromImages).mockResolvedValue(undefined);

    const summary = await runBatchSequenceToVideoJob(request, emitter);

    expect(prepareSequenceFramesForOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        imagePaths: ['D:\\seq-a\\001.png', 'D:\\seq-a\\002.png'],
        resize: { width: 640, height: 360 },
        upscaleMode: '2x',
        upscalerConfig: { kind: 'realcugan', variant: 'denoise' },
        alphaMode: 'straight',
        logLabel: 'seq-a',
      })
    );
    expect(createVideoFromImages).toHaveBeenCalledWith(
      expect.objectContaining({
        imagePaths: ['D:\\temp\\001.png', 'D:\\temp\\002.png'],
        outputPath: 'D:\\seq-a\\seq-a.mp4',
        fps: 24,
        speed: 1,
        quality: 100,
        format: 'mp4-h264',
      })
    );
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({
      headline: 'Batch sequence-to-video finished. Completed 1, failed 0.',
      outputs: ['D:\\seq-a\\seq-a.mp4'],
      completed: 1,
      failed: 0,
      failures: [],
    });
  });

  it('runs batch image upscale with explicit output routing and scaled resize', async () => {
    const emitter = createEmitter();
    const request: BatchImageUpscaleJob = {
      ...createBatchImageUpscaleJob(),
      outputMode: 'custom-root',
      outputRoot: 'D:\\out',
      upscalerConfig: { kind: 'nearest' },
    };

    vi.mocked(resolveBatchImageUpscaleDirectory).mockReturnValue('D:\\out');
    vi.mocked(resolveImageUpscaleDirectory).mockResolvedValue('D:\\out');
    vi.mocked(resolveImageUpscaleOutputPath).mockResolvedValue('D:\\out\\sprite.png');
    vi.mocked(resolveImageResizeTarget).mockResolvedValue({ width: 32, height: 32 });
    vi.mocked(probeMediaInfo).mockResolvedValue({
      width: 16,
      height: 16,
      hasAlpha: true,
    });
    vi.mocked(convertStillImage).mockResolvedValue(undefined);

    const summary = await runBatchImageUpscaleJob(request, emitter);

    expect(resolveBatchImageUpscaleDirectory).toHaveBeenCalledWith(request, 'D:\\sprite.png');
    expect(convertStillImage).toHaveBeenCalledWith(
      expect.objectContaining({
        inputPath: 'D:\\sprite.png',
        outputPath: 'D:\\out\\sprite.png',
        format: 'png',
        quality: 100,
        resize: { width: 64, height: 64, flags: 'neighbor' },
      })
    );
    expect(summary).toEqual({
      headline: 'Batch image upscale finished. Completed 1, failed 0.',
      outputs: ['D:\\out\\sprite.png'],
      completed: 1,
      failed: 0,
      failures: [],
    });
  });

  it('runs batch video upscale with explicit output routing', async () => {
    const emitter = createEmitter();
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const request: BatchVideoUpscaleJob = {
      ...createBatchVideoUpscaleJob(),
      outputMode: 'custom-root',
      outputRoot: 'D:\\out',
      upscalerConfig: { kind: 'realcugan', variant: 'denoise' },
      alphaMode: 'straight',
    };

    vi.mocked(resolveBatchVideoUpscaleOutput).mockResolvedValue('D:\\out\\clip_upscaled.mov');
    vi.mocked(resolveVideoUpscaleOutput).mockImplementation(async (job) => job.outputPath ?? '');
    vi.mocked(probeMediaInfo).mockResolvedValue({
      width: 1920,
      height: 1080,
      frameRate: 30,
      durationSeconds: 1,
      hasAlpha: false,
    });
    vi.mocked(resolveVideoResizeTarget).mockResolvedValue({ width: 960, height: 540 });
    vi.mocked(extractVideoFramesForVideoUpscale).mockResolvedValue({
      imagePaths: ['D:\\temp\\0001.png'],
      cleanup,
    });
    vi.mocked(createVideoFromImages).mockResolvedValue(undefined);

    const summary = await runBatchVideoUpscaleJob(request, emitter);

    expect(resolveBatchVideoUpscaleOutput).toHaveBeenCalledWith(request, 'D:\\clip.mov');
    expect(extractVideoFramesForVideoUpscale).toHaveBeenCalledWith(
      expect.objectContaining({
        videoPath: 'D:\\clip.mov',
        sourceFps: 30,
        resize: { width: 960, height: 540 },
        upscaleMode: '2x',
        upscalerConfig: { kind: 'realcugan', variant: 'denoise' },
        alphaMode: 'straight',
      })
    );
    expect(summary).toEqual({
      headline: 'Batch video upscale finished. Completed 1, failed 0.',
      outputs: ['D:\\out\\clip_upscaled.mov'],
      completed: 1,
      failed: 0,
      failures: [],
    });
  });
});
