import type { SequenceSourcePreview, VideoSourcePreview } from '../../../../shared/previews';
import { formatResolution } from '../../lib/formatters';
import { basenameLabel } from '../../lib/path-utils';
import type {
  ActivityState,
  TabId,
  ValidationState,
  WorkflowJobsState,
  WorkflowViewModel,
} from './types';

export function getTopHelperText(
  activeTab: TabId,
  validation: ValidationState,
  activity: ActivityState
): string {
  if (activity.running) {
    return activity.currentItem || activity.message;
  }

  if (!validation.sourceReady) {
    return getSourceHelperText(activeTab, validation);
  }

  if (!validation.parametersReady) {
    return activeTab === 'image-upscale' ||
      activeTab === 'video-upscale' ||
      activeTab === 'batch-image-upscale' ||
      activeTab === 'batch-video-upscale'
      ? 'Review resolution, upscale, and format settings in the sidebar to continue.'
      : 'Review timing, resolution, upscale, and format settings in the sidebar to continue.';
  }

  if (!validation.outputReady) {
    return 'Choose an export destination to continue.';
  }

  if (activity.success === false || activity.success === true) {
    return activity.message;
  }

  return 'Everything required for this run is ready.';
}

export function getTopHelperTone(
  validation: ValidationState,
  activity: ActivityState
): 'muted' | 'warning' {
  if (activity.running) {
    return 'muted';
  }

  return validation.ready ? 'muted' : 'warning';
}

export function getPrimaryActionHint(workflow: WorkflowViewModel, activity: ActivityState): string {
  if (activity.running) {
    return activity.currentItem || activity.message;
  }

  if (!workflow.validation.ready) {
    return workflow.validation.blocking.join(' ');
  }

  if (activity.success === false || activity.success === true) {
    return activity.message;
  }

  return 'All required setup is complete.';
}

export function getPrimaryActionHintTone(
  validation: ValidationState,
  activity: ActivityState
): 'muted' | 'warning' | 'error' | 'success' {
  if (activity.running) {
    return 'muted';
  }
  if (!validation.ready) {
    return 'warning';
  }
  if (activity.success === false) {
    return 'error';
  }
  if (activity.success === true) {
    return 'success';
  }
  return 'muted';
}

export function getSourceHelperText(activeTab: TabId, validation: ValidationState): string {
  if (validation.sourceReady) {
    switch (activeTab) {
      case 'sequence-to-video':
        return 'Source loaded. Review the frame preview and continue in the sidebar.';
      case 'video-to-sequence':
        return 'Source loaded. Review the detected video details and continue in the sidebar.';
      case 'image-upscale':
        return 'Source loaded. Review the image preview and continue in the sidebar.';
      case 'video-upscale':
        return 'Source loaded. Review the detected video details and continue in the sidebar.';
      case 'batch-video-to-sequence':
        return 'Batch source is ready. Review extraction settings and output location.';
      case 'batch-image-upscale':
        return 'Batch source is ready. Review upscale settings and output location.';
      case 'batch-video-upscale':
        return 'Batch source is ready. Review upscale settings and output location.';
      case 'batch-sequence-to-video':
        return 'Batch source is ready. Review encode settings and output location.';
      default:
        return 'Source is ready.';
    }
  }

  switch (activeTab) {
    case 'sequence-to-video':
      return 'Select a source folder or image files to continue.';
    case 'video-to-sequence':
      return 'Select a source video to continue.';
    case 'image-upscale':
      return 'Select one or more source images to continue.';
    case 'video-upscale':
      return 'Select a source video to continue.';
    case 'batch-video-to-sequence':
      return 'Select video files or choose a root folder to continue.';
    case 'batch-image-upscale':
      return 'Select image files or choose a root folder to continue.';
    case 'batch-video-upscale':
      return 'Select video files or choose a root folder to continue.';
    case 'batch-sequence-to-video':
      return 'Select sequence folders or choose a root folder to continue.';
    default:
      return 'Load a source to continue.';
  }
}

export function getSourceBadgeLabel(
  activeTab: TabId,
  state: WorkflowJobsState & {
    sequencePreview: SequenceSourcePreview | null;
    videoPreview: VideoSourcePreview | null;
  }
): string {
  switch (activeTab) {
    case 'sequence-to-video':
      if (!state.sequencePreview) {
        return 'Awaiting input';
      }
      return state.sequenceToVideo.sourceMode === 'folder'
        ? `1 folder, ${state.sequencePreview.frameCount} frames`
        : `${state.sequencePreview.frameCount} frames`;
    case 'video-to-sequence':
      return state.videoPreview
        ? `1 video, ${formatResolution(state.videoPreview.width, state.videoPreview.height) || 'ready'}`
        : 'Awaiting input';
    case 'image-upscale':
      return (state.imageUpscale.imagePaths?.length ?? 0) > 0
        ? `${state.imageUpscale.imagePaths?.length ?? 0} image(s)`
        : 'Awaiting input';
    case 'video-upscale':
      return state.videoPreview
        ? `1 video, ${formatResolution(state.videoPreview.width, state.videoPreview.height) || 'ready'}`
        : 'Awaiting input';
    case 'batch-video-to-sequence':
      return state.batchVideoToSequence.sourceMode === 'files'
        ? (state.batchVideoToSequence.videoPaths?.length ?? 0) > 0
          ? `${state.batchVideoToSequence.videoPaths?.length ?? 0} files`
          : 'Awaiting input'
        : state.batchVideoToSequence.scanRoot?.trim()
          ? `Scan ${basenameLabel(state.batchVideoToSequence.scanRoot)}`
          : 'Awaiting input';
    case 'batch-image-upscale':
      return state.batchImageUpscale.sourceMode === 'files'
        ? (state.batchImageUpscale.imagePaths?.length ?? 0) > 0
          ? `${state.batchImageUpscale.imagePaths?.length ?? 0} files`
          : 'Awaiting input'
        : state.batchImageUpscale.scanRoot?.trim()
          ? `Scan ${basenameLabel(state.batchImageUpscale.scanRoot)}`
          : 'Awaiting input';
    case 'batch-video-upscale':
      return state.batchVideoUpscale.sourceMode === 'files'
        ? (state.batchVideoUpscale.videoPaths?.length ?? 0) > 0
          ? `${state.batchVideoUpscale.videoPaths?.length ?? 0} files`
          : 'Awaiting input'
        : state.batchVideoUpscale.scanRoot?.trim()
          ? `Scan ${basenameLabel(state.batchVideoUpscale.scanRoot)}`
          : 'Awaiting input';
    case 'batch-sequence-to-video':
      return state.batchSequenceToVideo.sourceMode === 'folders'
        ? (state.batchSequenceToVideo.sequenceFolders?.length ?? 0) > 0
          ? `${state.batchSequenceToVideo.sequenceFolders?.length ?? 0} folders`
          : 'Awaiting input'
        : state.batchSequenceToVideo.scanRoot?.trim()
          ? `Scan ${basenameLabel(state.batchSequenceToVideo.scanRoot)}`
          : 'Awaiting input';
    default:
      return 'Awaiting input';
  }
}
