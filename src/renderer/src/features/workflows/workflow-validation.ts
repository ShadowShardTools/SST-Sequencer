import {
  getUpscalerConfigValidationError,
  isUpscaleModeSupportedByUpscaler,
  isValidAlphaMode,
  isValidUpscaleMode,
  isValidUpscalerType,
  type UpscalerConfig,
} from '../../../../shared/upscalers/registry';
import {
  isValidBackgroundRemoveModel,
  isValidFps,
  isValidQuality,
  isValidSpeed,
} from '../../../../shared/formats';
import { isValidResolutionSettings } from '../../../../shared/resolution';
import type { TabId, ValidationState, WorkflowJobsState } from './types';

export function validateWorkflow(activeTab: TabId, state: WorkflowJobsState): ValidationState {
  switch (activeTab) {
    case 'sequence-to-video':
      return validateSequenceToVideo(state.sequenceToVideo);
    case 'video-to-sequence':
      return validateVideoToSequence(state.videoToSequence);
    case 'batch-image-upscale':
      return validateBatchImageUpscale(state.batchImageUpscale);
    case 'batch-video-upscale':
      return validateBatchVideoUpscale(state.batchVideoUpscale);
    case 'batch-video-to-sequence':
      return validateBatchVideoToSequence(state.batchVideoToSequence);
    case 'image-upscale':
      return validateImageUpscale(state.imageUpscale);
    case 'video-upscale':
      return validateVideoUpscale(state.videoUpscale);
    case 'batch-sequence-to-video':
      return validateBatchSequenceToVideo(state.batchSequenceToVideo);
    default:
      throw new Error('Unknown workflow.');
  }
}

function validateSequenceToVideo(job: WorkflowJobsState['sequenceToVideo']): ValidationState {
  const sourceReady =
    job.sourceMode === 'folder'
      ? Boolean(job.sequenceFolder?.trim())
      : (job.imagePaths?.length ?? 0) > 0;
  const upscaler = job.upscalerConfig.kind;
  const upscalerReady = isValidUpscalerType(upscaler);
  const upscaleReady =
    isValidUpscaleMode(job.upscaleMode) &&
    isUpscaleModeSupportedByUpscaler(upscaler, job.upscaleMode);
  const alphaReady = isValidAlphaMode(job.alphaMode);
  const configBlocking = getUpscalerConfigBlocking(job);
  const backgroundRemoveBlocking = getBackgroundRemoveBlocking(job);
  const parametersReady =
    isValidFps(job.fps) &&
    isValidSpeed(job.speed) &&
    isValidQuality(job.quality) &&
    isValidResolutionSettings(job) &&
    upscalerReady &&
    upscaleReady &&
    alphaReady &&
    configBlocking.length === 0 &&
    backgroundRemoveBlocking.length === 0;
  const outputReady = true;
  const blocking: string[] = [];

  if (!sourceReady) {
    blocking.push('Select a source folder or image files to continue.');
  }
  if (!isValidFps(job.fps)) {
    blocking.push('Set FPS between 1 and 120.');
  }
  if (!isValidSpeed(job.speed)) {
    blocking.push('Set speed between 0.25 and 8.');
  }
  if (!isValidQuality(job.quality)) {
    blocking.push('Set quality between 1% and 100%.');
  }
  if (!isValidResolutionSettings(job)) {
    blocking.push('Set custom resolution width and height between 2 and 8192.');
  }
  if (!upscalerReady) {
    blocking.push('Choose a valid upscaler.');
  }
  if (!upscaleReady) {
    blocking.push('Choose a supported upscale amount for this upscaler.');
  }
  if (!alphaReady) {
    blocking.push('Choose a valid alpha mode.');
  }
  blocking.push(...configBlocking);
  blocking.push(...backgroundRemoveBlocking);
  return {
    ready: blocking.length === 0,
    blocking,
    sourceReady,
    parametersReady,
    outputReady,
  };
}

function validateVideoToSequence(job: WorkflowJobsState['videoToSequence']): ValidationState {
  const sourceReady = Boolean(job.videoPath?.trim());
  const rateReady = isValidFps(job.fps) && isValidSpeed(job.speed);
  const qualityReady = isValidQuality(job.quality);
  const resolutionReady = isValidResolutionSettings(job);
  const upscaler = job.upscalerConfig.kind;
  const upscalerReady = isValidUpscalerType(upscaler);
  const upscaleReady =
    isValidUpscaleMode(job.upscaleMode) &&
    isUpscaleModeSupportedByUpscaler(upscaler, job.upscaleMode);
  const alphaReady = isValidAlphaMode(job.alphaMode);
  const configBlocking = getUpscalerConfigBlocking(job);
  const backgroundRemoveBlocking = getBackgroundRemoveBlocking(job);
  const prefixReady = Boolean(job.prefix.trim());
  const numberingReady = Number.isFinite(job.startNumber) && job.startNumber >= 0;
  const parametersReady =
    rateReady &&
    qualityReady &&
    resolutionReady &&
    upscalerReady &&
    upscaleReady &&
    alphaReady &&
    prefixReady &&
    numberingReady &&
    configBlocking.length === 0 &&
    backgroundRemoveBlocking.length === 0;
  const outputReady = true;
  const blocking: string[] = [];

  if (!sourceReady) {
    blocking.push('Select a source video to continue.');
  }
  if (!isValidFps(job.fps)) {
    blocking.push('Set FPS between 1 and 120.');
  }
  if (!isValidSpeed(job.speed)) {
    blocking.push('Set speed between 0.25 and 8.');
  }
  if (!qualityReady) {
    blocking.push('Set image quality between 1% and 100%.');
  }
  if (!resolutionReady) {
    blocking.push('Set custom resolution width and height between 2 and 8192.');
  }
  if (!upscalerReady) {
    blocking.push('Choose a valid upscaler.');
  }
  if (!upscaleReady) {
    blocking.push('Choose a supported upscale amount for this upscaler.');
  }
  if (!alphaReady) {
    blocking.push('Choose a valid alpha mode.');
  }
  if (!prefixReady) {
    blocking.push('Enter a frame prefix.');
  }
  if (!numberingReady) {
    blocking.push('Set a start number of 0 or higher.');
  }
  blocking.push(...configBlocking);
  blocking.push(...backgroundRemoveBlocking);

  return {
    ready: blocking.length === 0,
    blocking,
    sourceReady,
    parametersReady,
    outputReady,
  };
}

function validateBatchVideoToSequence(
  job: WorkflowJobsState['batchVideoToSequence']
): ValidationState {
  const sourceReady =
    job.sourceMode === 'files' ? (job.videoPaths?.length ?? 0) > 0 : Boolean(job.scanRoot?.trim());
  const fpsReady = !job.overrideFps || isValidFps(job.fps);
  const speedReady = isValidSpeed(job.speed);
  const qualityReady = isValidQuality(job.quality);
  const resolutionReady = isValidResolutionSettings(job);
  const upscaler = job.upscalerConfig.kind;
  const upscalerReady = isValidUpscalerType(upscaler);
  const upscaleReady =
    isValidUpscaleMode(job.upscaleMode) &&
    isUpscaleModeSupportedByUpscaler(upscaler, job.upscaleMode);
  const alphaReady = isValidAlphaMode(job.alphaMode);
  const configBlocking = getUpscalerConfigBlocking(job);
  const backgroundRemoveBlocking = getBackgroundRemoveBlocking(job);
  const rateReady = fpsReady && speedReady;
  const prefixReady = Boolean(job.prefix.trim());
  const numberingReady = Number.isFinite(job.startNumber) && job.startNumber >= 0;
  const parametersReady =
    rateReady &&
    qualityReady &&
    resolutionReady &&
    upscalerReady &&
    upscaleReady &&
    alphaReady &&
    prefixReady &&
    numberingReady &&
    configBlocking.length === 0 &&
    backgroundRemoveBlocking.length === 0;
  const outputReady = job.outputMode === 'for-each' || Boolean(job.outputRoot?.trim());
  const blocking: string[] = [];

  if (!sourceReady) {
    blocking.push(
      job.sourceMode === 'files'
        ? 'Select at least one video file to continue.'
        : 'Choose a root folder to scan.'
    );
  }
  if (job.overrideFps && !isValidFps(job.fps)) {
    blocking.push('Set FPS between 1 and 120.');
  }
  if (!isValidSpeed(job.speed)) {
    blocking.push('Set speed between 0.25 and 8.');
  }
  if (!qualityReady) {
    blocking.push('Set image quality between 1% and 100%.');
  }
  if (!resolutionReady) {
    blocking.push('Set custom resolution width and height between 2 and 8192.');
  }
  if (!upscalerReady) {
    blocking.push('Choose a valid upscaler.');
  }
  if (!upscaleReady) {
    blocking.push('Choose a supported upscale amount for this upscaler.');
  }
  if (!alphaReady) {
    blocking.push('Choose a valid alpha mode.');
  }
  if (!prefixReady) {
    blocking.push('Enter a frame prefix.');
  }
  if (!numberingReady) {
    blocking.push('Set a start number of 0 or higher.');
  }
  blocking.push(...configBlocking);
  blocking.push(...backgroundRemoveBlocking);
  if (!outputReady) {
    blocking.push('Choose an export folder for selected export path.');
  }

  return {
    ready: blocking.length === 0,
    blocking,
    sourceReady,
    parametersReady,
    outputReady,
  };
}

function validateBatchImageUpscale(
  job: WorkflowJobsState['batchImageUpscale']
): ValidationState {
  const sourceReady =
    job.sourceMode === 'files' ? (job.imagePaths?.length ?? 0) > 0 : Boolean(job.scanRoot?.trim());
  const upscaler = job.upscalerConfig.kind;
  const configBlocking = getUpscalerConfigBlocking(job);
  const backgroundRemoveBlocking = getBackgroundRemoveBlocking(job);
  const parametersReady =
    isValidQuality(job.quality) &&
    isValidResolutionSettings(job) &&
    isValidUpscalerType(upscaler) &&
    isValidUpscaleMode(job.upscaleMode) &&
    isUpscaleModeSupportedByUpscaler(upscaler, job.upscaleMode) &&
    isValidAlphaMode(job.alphaMode) &&
    configBlocking.length === 0 &&
    backgroundRemoveBlocking.length === 0;
  const outputReady = job.outputMode === 'for-each' || Boolean(job.outputRoot?.trim());
  const blocking: string[] = [];

  if (!sourceReady) {
    blocking.push(
      job.sourceMode === 'files'
        ? 'Select at least one image file to continue.'
        : 'Choose a root folder to scan.'
    );
  }
  if (!isValidQuality(job.quality)) {
    blocking.push('Set image quality between 1% and 100%.');
  }
  if (!isValidResolutionSettings(job)) {
    blocking.push('Set custom resolution width and height between 2 and 8192.');
  }
  if (!isValidUpscalerType(upscaler)) {
    blocking.push('Choose a valid upscaler.');
  }
  if (
    !isValidUpscaleMode(job.upscaleMode) ||
    !isUpscaleModeSupportedByUpscaler(upscaler, job.upscaleMode)
  ) {
    blocking.push('Choose a supported upscale amount for this upscaler.');
  }
  if (!isValidAlphaMode(job.alphaMode)) {
    blocking.push('Choose a valid alpha mode.');
  }
  blocking.push(...configBlocking);
  blocking.push(...backgroundRemoveBlocking);
  if (!outputReady) {
    blocking.push('Choose an export folder for selected export path.');
  }

  return {
    ready: blocking.length === 0,
    blocking,
    sourceReady,
    parametersReady,
    outputReady,
  };
}

function validateBatchVideoUpscale(
  job: WorkflowJobsState['batchVideoUpscale']
): ValidationState {
  const sourceReady =
    job.sourceMode === 'files' ? (job.videoPaths?.length ?? 0) > 0 : Boolean(job.scanRoot?.trim());
  const upscaler = job.upscalerConfig.kind;
  const configBlocking = getUpscalerConfigBlocking(job);
  const backgroundRemoveBlocking = getBackgroundRemoveBlocking(job);
  const parametersReady =
    isValidQuality(job.quality) &&
    isValidResolutionSettings(job) &&
    isValidUpscalerType(upscaler) &&
    isValidUpscaleMode(job.upscaleMode) &&
    isUpscaleModeSupportedByUpscaler(upscaler, job.upscaleMode) &&
    isValidAlphaMode(job.alphaMode) &&
    configBlocking.length === 0 &&
    backgroundRemoveBlocking.length === 0;
  const outputReady = job.outputMode === 'for-each' || Boolean(job.outputRoot?.trim());
  const blocking: string[] = [];

  if (!sourceReady) {
    blocking.push(
      job.sourceMode === 'files'
        ? 'Select at least one video file to continue.'
        : 'Choose a root folder to scan.'
    );
  }
  if (!isValidQuality(job.quality)) {
    blocking.push('Set quality between 1% and 100%.');
  }
  if (!isValidResolutionSettings(job)) {
    blocking.push('Set custom resolution width and height between 2 and 8192.');
  }
  if (!isValidUpscalerType(upscaler)) {
    blocking.push('Choose a valid upscaler.');
  }
  if (
    !isValidUpscaleMode(job.upscaleMode) ||
    !isUpscaleModeSupportedByUpscaler(upscaler, job.upscaleMode)
  ) {
    blocking.push('Choose a supported upscale amount for this upscaler.');
  }
  if (!isValidAlphaMode(job.alphaMode)) {
    blocking.push('Choose a valid alpha mode.');
  }
  blocking.push(...configBlocking);
  blocking.push(...backgroundRemoveBlocking);
  if (!outputReady) {
    blocking.push('Choose an export folder for selected export path.');
  }

  return {
    ready: blocking.length === 0,
    blocking,
    sourceReady,
    parametersReady,
    outputReady,
  };
}

function validateImageUpscale(job: WorkflowJobsState['imageUpscale']): ValidationState {
  const sourceReady = (job.imagePaths?.length ?? 0) > 0;
  const upscaler = job.upscalerConfig.kind;
  const configBlocking = getUpscalerConfigBlocking(job);
  const backgroundRemoveBlocking = getBackgroundRemoveBlocking(job);
  const parametersReady =
    isValidQuality(job.quality) &&
    isValidResolutionSettings(job) &&
    isValidUpscalerType(upscaler) &&
    isValidUpscaleMode(job.upscaleMode) &&
    isUpscaleModeSupportedByUpscaler(upscaler, job.upscaleMode) &&
    isValidAlphaMode(job.alphaMode) &&
    configBlocking.length === 0 &&
    backgroundRemoveBlocking.length === 0;
  const outputReady = true;
  const blocking: string[] = [];

  if (!sourceReady) {
    blocking.push('Select one or more source images to continue.');
  }
  if (!isValidQuality(job.quality)) {
    blocking.push('Set image quality between 1% and 100%.');
  }
  if (!isValidResolutionSettings(job)) {
    blocking.push('Set custom resolution width and height between 2 and 8192.');
  }
  if (!isValidUpscalerType(upscaler)) {
    blocking.push('Choose a valid upscaler.');
  }
  if (
    !isValidUpscaleMode(job.upscaleMode) ||
    !isUpscaleModeSupportedByUpscaler(upscaler, job.upscaleMode)
  ) {
    blocking.push('Choose a supported upscale amount for this upscaler.');
  }
  if (!isValidAlphaMode(job.alphaMode)) {
    blocking.push('Choose a valid alpha mode.');
  }
  blocking.push(...configBlocking);
  blocking.push(...backgroundRemoveBlocking);

  return {
    ready: blocking.length === 0,
    blocking,
    sourceReady,
    parametersReady,
    outputReady,
  };
}

function validateVideoUpscale(job: WorkflowJobsState['videoUpscale']): ValidationState {
  const sourceReady = Boolean(job.videoPath?.trim());
  const upscaler = job.upscalerConfig.kind;
  const configBlocking = getUpscalerConfigBlocking(job);
  const backgroundRemoveBlocking = getBackgroundRemoveBlocking(job);
  const parametersReady =
    isValidQuality(job.quality) &&
    isValidResolutionSettings(job) &&
    isValidUpscalerType(upscaler) &&
    isValidUpscaleMode(job.upscaleMode) &&
    isUpscaleModeSupportedByUpscaler(upscaler, job.upscaleMode) &&
    isValidAlphaMode(job.alphaMode) &&
    configBlocking.length === 0 &&
    backgroundRemoveBlocking.length === 0;
  const outputReady = true;
  const blocking: string[] = [];

  if (!sourceReady) {
    blocking.push('Select a source video to continue.');
  }
  if (!isValidQuality(job.quality)) {
    blocking.push('Set quality between 1% and 100%.');
  }
  if (!isValidResolutionSettings(job)) {
    blocking.push('Set custom resolution width and height between 2 and 8192.');
  }
  if (!isValidUpscalerType(upscaler)) {
    blocking.push('Choose a valid upscaler.');
  }
  if (
    !isValidUpscaleMode(job.upscaleMode) ||
    !isUpscaleModeSupportedByUpscaler(upscaler, job.upscaleMode)
  ) {
    blocking.push('Choose a supported upscale amount for this upscaler.');
  }
  if (!isValidAlphaMode(job.alphaMode)) {
    blocking.push('Choose a valid alpha mode.');
  }
  blocking.push(...configBlocking);
  blocking.push(...backgroundRemoveBlocking);

  return {
    ready: blocking.length === 0,
    blocking,
    sourceReady,
    parametersReady,
    outputReady,
  };
}

function validateBatchSequenceToVideo(
  job: WorkflowJobsState['batchSequenceToVideo']
): ValidationState {
  const sourceReady =
    job.sourceMode === 'folders'
      ? (job.sequenceFolders?.length ?? 0) > 0
      : Boolean(job.scanRoot?.trim());
  const upscaler = job.upscalerConfig.kind;
  const configBlocking = getUpscalerConfigBlocking(job);
  const backgroundRemoveBlocking = getBackgroundRemoveBlocking(job);
  const parametersReady =
    isValidFps(job.fps) &&
    isValidSpeed(job.speed) &&
    isValidQuality(job.quality) &&
    isValidResolutionSettings(job) &&
    isValidUpscalerType(upscaler) &&
    isValidUpscaleMode(job.upscaleMode) &&
    isUpscaleModeSupportedByUpscaler(upscaler, job.upscaleMode) &&
    isValidAlphaMode(job.alphaMode) &&
    configBlocking.length === 0 &&
    backgroundRemoveBlocking.length === 0;
  const outputReady = job.outputMode === 'for-each' || Boolean(job.outputRoot?.trim());
  const blocking: string[] = [];

  if (!sourceReady) {
    blocking.push(
      job.sourceMode === 'folders'
        ? 'Select at least one sequence folder to continue.'
        : 'Choose a root folder to scan.'
    );
  }
  if (!isValidFps(job.fps)) {
    blocking.push('Set FPS between 1 and 120.');
  }
  if (!isValidSpeed(job.speed)) {
    blocking.push('Set speed between 0.25 and 8.');
  }
  if (!isValidQuality(job.quality)) {
    blocking.push('Set quality between 1% and 100%.');
  }
  if (!isValidResolutionSettings(job)) {
    blocking.push('Set custom resolution width and height between 2 and 8192.');
  }
  if (!isValidUpscalerType(upscaler)) {
    blocking.push('Choose a valid upscaler.');
  }
  if (
    !isValidUpscaleMode(job.upscaleMode) ||
    !isUpscaleModeSupportedByUpscaler(upscaler, job.upscaleMode)
  ) {
    blocking.push('Choose a supported upscale amount for this upscaler.');
  }
  if (!isValidAlphaMode(job.alphaMode)) {
    blocking.push('Choose a valid alpha mode.');
  }
  blocking.push(...configBlocking);
  blocking.push(...backgroundRemoveBlocking);
  if (!outputReady) {
    blocking.push('Choose an export folder for selected export path.');
  }

  return {
    ready: blocking.length === 0,
    blocking,
    sourceReady,
    parametersReady,
    outputReady,
  };
}

type UpscalerConfigState = {
  upscalerConfig: UpscalerConfig;
};

type BackgroundRemoveState = {
  backgroundRemove: boolean;
  backgroundRemoveModel: string;
};

function getUpscalerConfigBlocking(job: UpscalerConfigState): string[] {
  const validationError = getUpscalerConfigValidationError(job.upscalerConfig);
  return validationError ? [validationError] : [];
}

function getBackgroundRemoveBlocking(job: BackgroundRemoveState): string[] {
  if (!job.backgroundRemove) {
    return [];
  }

  return isValidBackgroundRemoveModel(job.backgroundRemoveModel)
    ? []
    : ['Choose a valid background remover model.'];
}
