import { basename } from 'node:path';
import type { JobSummary, VideoUpscaleJob } from '../../shared/jobs';
import { createVideoFromImages } from '../media/ffmpeg';
import { probeMediaInfo } from '../media/ffprobe';
import { resolveVideoUpscaleOutput } from '../media/outputs';
import { resolveVideoResizeTarget } from '../media/resize';
import { extractVideoFramesForVideoUpscale } from '../media/pipelines/upscale-video-via-frames';
import type { JobEmitter } from '../media/types';
import {
  validateAlphaMode,
  validateBackgroundRemoveModel,
  validateQualitySetting,
  validateResolutionSetting,
  validateUpscaleMode,
  validateUpscalerPresetConfiguration,
  validateUpscalerType,
} from '../media/validation';

export async function runVideoUpscaleJob(
  request: VideoUpscaleJob,
  emitter: JobEmitter
): Promise<JobSummary> {
  const upscaler = request.upscalerConfig.kind;
  validateQualitySetting(request.quality);
  validateResolutionSetting(request);
  validateUpscalerType(upscaler);
  validateUpscaleMode(request.upscaleMode, upscaler);
  validateAlphaMode(request.alphaMode);
  validateBackgroundRemoveModel(request.backgroundRemoveModel);
  validateUpscalerPresetConfiguration(request.upscalerConfig);

  const videoPath = request.videoPath?.trim();
  if (!videoPath) {
    throw new Error('Select a source video before running the job.');
  }

  const outputPath = await resolveVideoUpscaleOutput(request);
  const sourceMediaInfo = await probeMediaInfo(videoPath);
  const resize = await resolveVideoResizeTarget(request, videoPath, {
    enforceEven: true,
  });
  const sourceFps =
    sourceMediaInfo.frameRate &&
    Number.isFinite(sourceMediaInfo.frameRate) &&
    sourceMediaInfo.frameRate > 0
      ? Math.round(sourceMediaInfo.frameRate * 1000) / 1000
      : 24;

  const preparedFrames = await extractVideoFramesForVideoUpscale({
    videoPath,
    sourceFps,
    resize,
    upscaleMode: request.upscaleMode,
    upscalerConfig: request.upscalerConfig,
    alphaMode: request.alphaMode,
    backgroundRemove: request.backgroundRemove,
    backgroundRemoveModel: request.backgroundRemoveModel,
    emitter,
    onExtractProgress: (percent) =>
      emitter.progress(percent * 0.5, `Extracting ${basename(videoPath)}`, {
        currentItem: basename(videoPath),
        overallIndex: 1,
        overallTotal: 1,
      }),
  });

  try {
    await createVideoFromImages({
      imagePaths: preparedFrames.imagePaths,
      outputPath,
      fps: sourceFps,
      speed: 1,
      quality: request.quality,
      format: request.format,
      audioSourcePath: videoPath,
      emitter,
      onProgress: (percent) =>
        emitter.progress(50 + percent * 0.5, `Encoding ${basename(outputPath)}`, {
          currentItem: basename(outputPath),
          overallIndex: 1,
          overallTotal: 1,
        }),
    });
  } finally {
    await preparedFrames.cleanup();
  }

  return {
    headline: `Upscaled video: ${outputPath}`,
    outputs: [outputPath],
    completed: 1,
    failed: 0,
    failures: [],
  };
}
