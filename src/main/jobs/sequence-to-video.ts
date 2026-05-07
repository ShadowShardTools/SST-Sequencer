import { basename } from 'node:path';
import type { JobSummary, SequenceToVideoJob } from '../../shared/jobs';
import { createVideoFromImages } from '../media/ffmpeg';
import { resolveSingleSequenceOutput, resolveSequenceInput } from '../media/outputs';
import { resolveSequenceResizeTarget } from '../media/resize';
import { prepareSequenceFramesForOutput } from '../media/pipelines/upscale-sequence-directory';
import type { JobEmitter } from '../media/types';
import {
  validateAlphaMode,
  validateQualitySetting,
  validateRateSettings,
  validateResolutionSetting,
  validateUpscaleMode,
  validateUpscalerPresetConfiguration,
  validateUpscalerType,
} from '../media/validation';

export async function runSequenceToVideoJob(
  request: SequenceToVideoJob,
  emitter: JobEmitter
): Promise<JobSummary> {
  const upscaler = request.upscalerConfig.kind;
  validateRateSettings(request.fps, request.speed);
  validateQualitySetting(request.quality);
  validateResolutionSetting(request);
  validateUpscalerType(upscaler);
  validateUpscaleMode(request.upscaleMode, upscaler);
  validateAlphaMode(request.alphaMode);
  validateUpscalerPresetConfiguration(request.upscalerConfig);

  const sourceImagePaths = await resolveSequenceInput(request);
  if (sourceImagePaths.length === 0) {
    throw new Error('No images were found for the selected sequence.');
  }

  const resize = await resolveSequenceResizeTarget(request, sourceImagePaths, {
    enforceEven: true,
  });
  const outputPath = await resolveSingleSequenceOutput(request, sourceImagePaths);
  const preparedFrames = await prepareSequenceFramesForOutput({
    imagePaths: sourceImagePaths,
    resize,
    upscaleMode: request.upscaleMode,
    upscalerConfig: request.upscalerConfig,
    alphaMode: request.alphaMode,
    emitter,
  });

  try {
    emitter.log(`Encoding ${preparedFrames.imagePaths.length} frames into ${basename(outputPath)}.`);

    await createVideoFromImages({
      imagePaths: preparedFrames.imagePaths,
      outputPath,
      fps: request.fps,
      speed: request.speed,
      quality: request.quality,
      format: request.format,
      resize: preparedFrames.resize,
      emitter,
      onProgress: (percent) =>
        emitter.progress(percent, `Encoding ${basename(outputPath)}`, {
          currentItem: basename(outputPath),
          overallIndex: 1,
          overallTotal: 1,
        }),
    });
  } finally {
    await preparedFrames.cleanup();
  }

  return {
    headline: `Created video: ${outputPath}`,
    outputs: [outputPath],
    completed: 1,
    failed: 0,
    failures: [],
  };
}
