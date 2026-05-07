import { basename } from 'node:path';
import type { BatchSequenceToVideoJob, JobFailure, JobSummary } from '../../shared/jobs';
import { createVideoFromImages } from '../media/ffmpeg';
import { dedupeAndSort, discoverSequenceFolders, getImageFilesFromFolder } from '../media/discovery';
import { resolveBatchVideoOutput } from '../media/outputs';
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
import { buildBatchSummary, getErrorMessage, scaleBatchPercent } from './job-helpers';

export async function runBatchSequenceToVideoJob(
  request: BatchSequenceToVideoJob,
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

  const sequenceFolders =
    request.sourceMode === 'folders'
      ? dedupeAndSort(request.sequenceFolders ?? [])
      : await discoverSequenceFolders(request.scanRoot, request.recursive);

  if (sequenceFolders.length === 0) {
    throw new Error('No image sequence folders were found for the batch job.');
  }

  const outputs: string[] = [];
  const failures: JobFailure[] = [];

  emitter.log(`Discovered ${sequenceFolders.length} sequence folder(s) for batch encoding.`);

  for (const [index, sequenceFolder] of sequenceFolders.entries()) {
    const currentIndex = index + 1;
    const label = basename(sequenceFolder);

    try {
      const imagePaths = await getImageFilesFromFolder(sequenceFolder);
      if (imagePaths.length === 0) {
        throw new Error('No supported image files were found in the sequence folder.');
      }

      const outputPath = await resolveBatchVideoOutput(request, sequenceFolder);
      const resize = await resolveSequenceResizeTarget(request, imagePaths, {
        enforceEven: true,
      });
      const preparedFrames = await prepareSequenceFramesForOutput({
        imagePaths,
        resize,
        upscaleMode: request.upscaleMode,
        upscalerConfig: request.upscalerConfig,
        alphaMode: request.alphaMode,
        emitter,
        logLabel: label,
      });
      emitter.log(`Starting ${label} (${currentIndex}/${sequenceFolders.length}).`);

      try {
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
            emitter.progress(
              scaleBatchPercent(currentIndex, sequenceFolders.length, percent),
              `Encoding ${label}`,
              {
                currentItem: label,
                overallIndex: currentIndex,
                overallTotal: sequenceFolders.length,
              }
            ),
        });
      } finally {
        await preparedFrames.cleanup();
      }

      outputs.push(outputPath);
    } catch (error) {
      const reason = getErrorMessage(error);
      failures.push({
        source: sequenceFolder,
        reason,
      });
      emitter.log(`Failed ${label}: ${reason}`, 'error');
    }
  }

  return buildBatchSummary(
    outputs,
    failures,
    'Batch sequence-to-video finished',
    'No videos were created from the selected sequences.'
  );
}
