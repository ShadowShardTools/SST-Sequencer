import { basename } from 'node:path';
import type { BatchVideoToSequenceJob, JobFailure, JobSummary } from '../../shared/jobs';
import { dedupeAndSort, discoverVideoFiles } from '../media/discovery';
import { resolveBatchSequenceDirectory } from '../media/outputs';
import { resolveVideoResizeTarget } from '../media/resize';
import { createImageSequenceFromVideoWithUpscale } from '../media/pipelines/upscale-video-via-frames';
import type { JobEmitter } from '../media/types';
import {
  validateAlphaMode,
  validateFpsSetting,
  validateQualitySetting,
  validateResolutionSetting,
  validateSpeedSetting,
  validateUpscaleMode,
  validateUpscalerPresetConfiguration,
  validateUpscalerType,
} from '../media/validation';
import {
  buildBatchSummary,
  getErrorMessage,
  resolveBatchVideoSourceFps,
  scaleBatchPercent,
} from './job-helpers';

export async function runBatchVideoToSequenceJob(
  request: BatchVideoToSequenceJob,
  emitter: JobEmitter
): Promise<JobSummary> {
  const upscaler = request.upscalerConfig.kind;
  validateSpeedSetting(request.speed);
  validateQualitySetting(request.quality);
  validateResolutionSetting(request);
  validateUpscalerType(upscaler);
  validateUpscaleMode(request.upscaleMode, upscaler);
  validateAlphaMode(request.alphaMode);
  validateUpscalerPresetConfiguration(request.upscalerConfig);
  if (request.overrideFps) {
    validateFpsSetting(request.fps);
  }

  const videoPaths =
    request.sourceMode === 'files'
      ? dedupeAndSort(request.videoPaths ?? [])
      : await discoverVideoFiles(request.scanRoot, request.recursive);

  if (videoPaths.length === 0) {
    throw new Error('No video files were found for the batch job.');
  }

  const outputs: string[] = [];
  const failures: JobFailure[] = [];

  emitter.log(`Discovered ${videoPaths.length} video file(s) for batch extraction.`);

  for (const [index, videoPath] of videoPaths.entries()) {
    const currentIndex = index + 1;
    const label = basename(videoPath);

    try {
      const outputDir = await resolveBatchSequenceDirectory(request, videoPath);
      const extractionFps = request.overrideFps
        ? request.fps
        : await resolveBatchVideoSourceFps(videoPath, request.fps, emitter);
      const resize = await resolveVideoResizeTarget(request, videoPath);
      emitter.log(`Starting ${label} (${currentIndex}/${videoPaths.length}).`);

      await createImageSequenceFromVideoWithUpscale({
        videoPath,
        outputDir,
        fps: extractionFps,
        speed: request.speed,
        quality: request.quality,
        resize,
        format: request.format,
        prefix: request.prefix,
        startNumber: request.startNumber,
        upscaleMode: request.upscaleMode,
        upscalerConfig: request.upscalerConfig,
        alphaMode: request.alphaMode,
        emitter,
        onExtractProgress: (percent) =>
          emitter.progress(
            scaleBatchPercent(currentIndex, videoPaths.length, percent),
            `Extracting ${label}`,
            {
              currentItem: label,
              overallIndex: currentIndex,
              overallTotal: videoPaths.length,
            }
          ),
      });

      outputs.push(outputDir);
    } catch (error) {
      const reason = getErrorMessage(error);
      failures.push({
        source: videoPath,
        reason,
      });
      emitter.log(`Failed ${label}: ${reason}`, 'error');
    }
  }

  return buildBatchSummary(
    outputs,
    failures,
    'Batch video-to-sequence finished',
    'No video sequences were created.'
  );
}
