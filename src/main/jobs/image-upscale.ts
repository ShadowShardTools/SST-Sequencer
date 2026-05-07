import { basename, join } from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { getUpscaleFactor } from '../../shared/upscalers/registry';
import type { ImageUpscaleJob, JobFailure, JobSummary } from '../../shared/jobs';
import { convertStillImage } from '../media/ffmpeg';
import { probeMediaInfo } from '../media/ffprobe';
import { resolveImageResizeTarget } from '../media/resize';
import { dedupeAndSort, getImageFilesFromFolder } from '../media/discovery';
import { resolveImageUpscaleDirectory, resolveImageUpscaleOutputPath } from '../media/outputs';
import type { JobEmitter } from '../media/types';
import { removeBackgroundImage } from '../media/background-remover';
import {
  validateAlphaMode,
  validateBackgroundRemoveModel,
  validateQualitySetting,
  validateResolutionSetting,
  validateUpscaleMode,
  validateUpscalerPresetConfiguration,
  validateUpscalerType,
} from '../media/validation';
import {
  buildBatchSummary,
  getErrorMessage,
  removeTemporaryDirectories,
  resolveUpscaledResize,
  scaleBatchPercent,
} from './job-helpers';
import { upscaleFrameDirectory } from '../media/pipelines/upscale-frame-directory';

export async function runImageUpscaleJob(
  request: ImageUpscaleJob,
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

  const imagePaths = dedupeAndSort(request.imagePaths ?? []);
  if (imagePaths.length === 0) {
    throw new Error('Select one or more source images before running the job.');
  }

  const outputDir = await resolveImageUpscaleDirectory(request, imagePaths);
  await mkdir(outputDir, { recursive: true });
  const outputs: string[] = [];
  const failures: JobFailure[] = [];
  const upscaleFactor = getUpscaleFactor(request.upscaleMode);

  for (const [index, imagePath] of imagePaths.entries()) {
    const currentIndex = index + 1;
    const label = basename(imagePath);
    const outputPath = await resolveImageUpscaleOutputPath(outputDir, imagePath, request.format);
    const mediaInfo = await probeMediaInfo(imagePath);
    const resize = await resolveImageResizeTarget(request, imagePath);
    const preserveAlpha = request.backgroundRemove || Boolean(mediaInfo.hasAlpha);
    let tempBaseDir = '';
    let tempBackgroundRemovedDir = '';
    let tempUpscaledDir = '';

    try {
      emitter.log(`Starting ${label} (${currentIndex}/${imagePaths.length}).`);

      if (upscaleFactor <= 1 && !request.backgroundRemove) {
        await convertStillImage({
          inputPath: imagePath,
          outputPath,
          format: request.format,
          quality: request.quality,
          resize,
          emitter,
        });
      } else if (upscaler === 'nearest' && !request.backgroundRemove) {
        const nearestResize = resolveUpscaledResize(
          resize,
          mediaInfo.width,
          mediaInfo.height,
          upscaleFactor
        );

        await convertStillImage({
          inputPath: imagePath,
          outputPath,
          format: request.format,
          quality: request.quality,
          resize: nearestResize ? { ...nearestResize, flags: 'neighbor' } : nearestResize,
          emitter,
        });
      } else {
        tempBaseDir = await mkdtemp(join(tmpdir(), 'sst-image-upscale-base-'));
        const baseImagePath = join(tempBaseDir, 'input.png');

        await convertStillImage({
          inputPath: imagePath,
          outputPath: baseImagePath,
          format: 'png',
          quality: 100,
          resize,
          emitter,
        });

        let preparedInputPath = baseImagePath;
        if (request.backgroundRemove) {
          tempBackgroundRemovedDir = await mkdtemp(join(tmpdir(), 'sst-image-upscale-bg-remove-'));
          preparedInputPath = join(tempBackgroundRemovedDir, 'input.png');
          await removeBackgroundImage({
            inputPath: baseImagePath,
            outputPath: preparedInputPath,
            model: request.backgroundRemoveModel,
            emitter,
          });
        }

        if (upscaleFactor <= 1) {
          await convertStillImage({
            inputPath: preparedInputPath,
            outputPath,
            format: request.format,
            quality: request.quality,
            emitter,
          });
        } else if (upscaler === 'nearest') {
          const nearestResize = resolveUpscaledResize(
            resize,
            mediaInfo.width,
            mediaInfo.height,
            upscaleFactor
          );

          await convertStillImage({
            inputPath: preparedInputPath,
            outputPath,
            format: request.format,
            quality: request.quality,
            resize: nearestResize ? { ...nearestResize, flags: 'neighbor' } : nearestResize,
            emitter,
          });
        } else {
          tempUpscaledDir = await mkdtemp(join(tmpdir(), 'sst-image-upscale-out-'));

          await upscaleFrameDirectory({
            upscalerConfig: request.upscalerConfig,
            inputDir: request.backgroundRemove ? tempBackgroundRemovedDir : tempBaseDir,
            outputDir: tempUpscaledDir,
            scale: upscaleFactor,
            preserveAlpha,
            alphaMode: request.alphaMode,
            emitter,
          });

          const upscaledPaths = await getImageFilesFromFolder(tempUpscaledDir);
          const upscaledPath = upscaledPaths[0];
          if (!upscaledPath) {
            throw new Error('The upscaler did not produce an output image.');
          }

          await convertStillImage({
            inputPath: upscaledPath,
            outputPath,
            format: request.format,
            quality: request.quality,
            emitter,
          });
        }
      }

      outputs.push(outputPath);
      emitter.progress(
        scaleBatchPercent(currentIndex, imagePaths.length, 100),
        `Upscaled ${label}`,
        {
          currentItem: label,
          overallIndex: currentIndex,
          overallTotal: imagePaths.length,
        }
      );
    } catch (error) {
      const reason = getErrorMessage(error);
      failures.push({
        source: imagePath,
        reason,
      });
      emitter.log(`Failed ${label}: ${reason}`, 'error');
    } finally {
      await removeTemporaryDirectories(
        ...[tempBaseDir, tempBackgroundRemovedDir, tempUpscaledDir].filter(Boolean)
      );
    }
  }

  return buildBatchSummary(outputs, failures, 'Image upscale finished', 'No images were upscaled.');
}
