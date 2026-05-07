import { basename } from 'node:path';
import type { JobSummary, VideoToSequenceJob } from '../../shared/jobs';
import { resolveSingleSequenceDirectory } from '../media/outputs';
import { resolveVideoResizeTarget } from '../media/resize';
import { createImageSequenceFromVideoWithUpscale } from '../media/pipelines/upscale-video-via-frames';
import type { JobEmitter } from '../media/types';
import {
  validateAlphaMode,
  validateBackgroundRemoveModel,
  validateQualitySetting,
  validateRateSettings,
  validateResolutionSetting,
  validateUpscaleMode,
  validateUpscalerPresetConfiguration,
  validateUpscalerType,
} from '../media/validation';

export async function runVideoToSequenceJob(
  request: VideoToSequenceJob,
  emitter: JobEmitter
): Promise<JobSummary> {
  const upscaler = request.upscalerConfig.kind;
  validateRateSettings(request.fps, request.speed);
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

  const resize = await resolveVideoResizeTarget(request, videoPath);
  const outputDir = await resolveSingleSequenceDirectory(request);

  await createImageSequenceFromVideoWithUpscale({
    videoPath,
    outputDir,
    fps: request.fps,
    speed: request.speed,
    quality: request.quality,
    resize,
    format: request.format,
    prefix: request.prefix,
    startNumber: request.startNumber,
    upscaleMode: request.upscaleMode,
    upscalerConfig: request.upscalerConfig,
    alphaMode: request.alphaMode,
    backgroundRemove: request.backgroundRemove,
    backgroundRemoveModel: request.backgroundRemoveModel,
    emitter,
    onExtractProgress: (percent) =>
      emitter.progress(percent, `Extracting ${basename(videoPath)}`, {
        currentItem: basename(videoPath),
        overallIndex: 1,
        overallTotal: 1,
      }),
  });

  return {
    headline: `Created image sequence: ${outputDir}`,
    outputs: [outputDir],
    completed: 1,
    failed: 0,
    failures: [],
  };
}
