import { basename } from 'node:path';
import type { BatchImageUpscaleJob, ImageUpscaleJob, JobFailure, JobSummary } from '../../shared/jobs';
import { dedupeAndSort, discoverImageFiles } from '../media/discovery';
import { resolveBatchImageUpscaleDirectory } from '../media/outputs';
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
import { runImageUpscaleJob } from './image-upscale';
import { buildBatchSummary, getErrorMessage, scaleBatchPercent } from './job-helpers';

export async function runBatchImageUpscaleJob(
  request: BatchImageUpscaleJob,
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

  const imagePaths =
    request.sourceMode === 'files'
      ? dedupeAndSort(request.imagePaths ?? [])
      : await discoverImageFiles(request.scanRoot, request.recursive);

  if (imagePaths.length === 0) {
    throw new Error('No image files were found for the batch job.');
  }

  const outputs: string[] = [];
  const failures: JobFailure[] = [];
  emitter.log(`Discovered ${imagePaths.length} image file(s) for batch upscale.`);

  for (const [index, imagePath] of imagePaths.entries()) {
    const currentIndex = index + 1;
    const label = basename(imagePath);

    try {
      const outputDir = resolveBatchImageUpscaleDirectory(request, imagePath);
      emitter.log(`Starting ${label} (${currentIndex}/${imagePaths.length}).`);

      const summary = await runImageUpscaleJob(
        {
          kind: 'image-upscale',
          imagePaths: [imagePath],
          outputDir,
          quality: request.quality,
          resolutionMode: request.resolutionMode,
          customWidth: request.customWidth,
          customHeight: request.customHeight,
          upscaleMode: request.upscaleMode,
          alphaMode: request.alphaMode,
          backgroundRemove: request.backgroundRemove,
          backgroundRemoveModel: request.backgroundRemoveModel,
          upscalerConfig: request.upscalerConfig,
          format: request.format,
        } satisfies ImageUpscaleJob,
        {
          started: () => {},
          finished: () => {},
          log: (message, level) => emitter.log(message, level),
          progress: (percent, message) =>
            emitter.progress(scaleBatchPercent(currentIndex, imagePaths.length, percent), message, {
              currentItem: label,
              overallIndex: currentIndex,
              overallTotal: imagePaths.length,
            }),
        }
      );

      outputs.push(...summary.outputs);
      failures.push(...summary.failures);
    } catch (error) {
      const reason = getErrorMessage(error);
      failures.push({
        source: imagePath,
        reason,
      });
      emitter.log(`Failed ${label}: ${reason}`, 'error');
    }
  }

  return buildBatchSummary(outputs, failures, 'Batch image upscale finished', 'No images were upscaled.');
}
