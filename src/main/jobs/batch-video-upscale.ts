import { basename } from 'node:path';
import type { BatchVideoUpscaleJob, JobFailure, JobSummary, VideoUpscaleJob } from '../../shared/jobs';
import { dedupeAndSort, discoverVideoFiles } from '../media/discovery';
import { resolveBatchVideoUpscaleOutput } from '../media/outputs';
import type { JobEmitter } from '../media/types';
import {
  validateAlphaMode,
  validateQualitySetting,
  validateResolutionSetting,
  validateUpscaleMode,
  validateUpscalerPresetConfiguration,
  validateUpscalerType,
} from '../media/validation';
import { buildBatchSummary, getErrorMessage, scaleBatchPercent } from './job-helpers';
import { runVideoUpscaleJob } from './video-upscale';

export async function runBatchVideoUpscaleJob(
  request: BatchVideoUpscaleJob,
  emitter: JobEmitter
): Promise<JobSummary> {
  const upscaler = request.upscalerConfig.kind;
  validateQualitySetting(request.quality);
  validateResolutionSetting(request);
  validateUpscalerType(upscaler);
  validateUpscaleMode(request.upscaleMode, upscaler);
  validateAlphaMode(request.alphaMode);
  validateUpscalerPresetConfiguration(request.upscalerConfig);

  const videoPaths =
    request.sourceMode === 'files'
      ? dedupeAndSort(request.videoPaths ?? [])
      : await discoverVideoFiles(request.scanRoot, request.recursive);

  if (videoPaths.length === 0) {
    throw new Error('No video files were found for the batch job.');
  }

  const outputs: string[] = [];
  const failures: JobFailure[] = [];
  emitter.log(`Discovered ${videoPaths.length} video file(s) for batch upscale.`);

  for (const [index, videoPath] of videoPaths.entries()) {
    const currentIndex = index + 1;
    const label = basename(videoPath);

    try {
      const outputPath = await resolveBatchVideoUpscaleOutput(request, videoPath);
      emitter.log(`Starting ${label} (${currentIndex}/${videoPaths.length}).`);

      const summary = await runVideoUpscaleJob(
        {
          kind: 'video-upscale',
          videoPath,
          outputPath,
          quality: request.quality,
          resolutionMode: request.resolutionMode,
          customWidth: request.customWidth,
          customHeight: request.customHeight,
          upscaleMode: request.upscaleMode,
          alphaMode: request.alphaMode,
          upscalerConfig: request.upscalerConfig,
          format: request.format,
        } satisfies VideoUpscaleJob,
        {
          started: () => {},
          finished: () => {},
          log: (message, level) => emitter.log(message, level),
          progress: (percent, message) =>
            emitter.progress(scaleBatchPercent(currentIndex, videoPaths.length, percent), message, {
              currentItem: label,
              overallIndex: currentIndex,
              overallTotal: videoPaths.length,
            }),
        }
      );

      outputs.push(...summary.outputs);
      failures.push(...summary.failures);
    } catch (error) {
      const reason = getErrorMessage(error);
      failures.push({
        source: videoPath,
        reason,
      });
      emitter.log(`Failed ${label}: ${reason}`, 'error');
    }
  }

  return buildBatchSummary(outputs, failures, 'Batch video upscale finished', 'No videos were upscaled.');
}
