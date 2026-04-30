import { isValidFps, isValidSpeed } from '../../../../shared/formats';
import type { SequenceSourcePreview, VideoSourcePreview } from '../../../../shared/previews';
import { basenameLabel, formatResolution } from '../../lib/media';
import type { WorkflowStepState } from '../../components/shell';
import type {
  ActivityState,
  TabId,
  ValidationState,
  WorkflowJobsState,
  WorkflowMeta,
  WorkflowViewModel,
} from './types';

const workflowMeta: WorkflowMeta[] = [
  {
    id: 'sequence-to-video',
    title: 'Sequence to Video',
    strap: 'Build a video from an image sequence.',
    category: 'Single',
    runLabel: 'Create video',
  },
  {
    id: 'video-to-sequence',
    title: 'Video to Sequence',
    strap: 'Extract image frames from one video.',
    category: 'Single',
    runLabel: 'Extract sequence',
  },
  {
    id: 'batch-video-to-sequence',
    title: 'Batch Videos to Sequences',
    strap: 'Process many videos in one batch.',
    category: 'Batch',
    runLabel: 'Run batch extraction',
  },
  {
    id: 'batch-sequence-to-video',
    title: 'Batch Sequences to Videos',
    strap: 'Encode many sequence folders in one pass.',
    category: 'Batch',
    runLabel: 'Run batch encode',
  },
];

export function buildWorkflowViewModel(
  activeTab: TabId,
  state: WorkflowJobsState
): WorkflowViewModel {
  const meta = workflowMeta.find((item) => item.id === activeTab);
  if (!meta) {
    throw new Error('Unknown workflow.');
  }

  switch (activeTab) {
    case 'sequence-to-video':
      return {
        request: state.sequenceToVideo,
        meta,
        validation: validateSequenceToVideo(state.sequenceToVideo),
      };
    case 'video-to-sequence':
      return {
        request: state.videoToSequence,
        meta,
        validation: validateVideoToSequence(state.videoToSequence),
      };
    case 'batch-video-to-sequence':
      return {
        request: state.batchVideoToSequence,
        meta,
        validation: validateBatchVideoToSequence(state.batchVideoToSequence),
      };
    case 'batch-sequence-to-video':
      return {
        request: state.batchSequenceToVideo,
        meta,
        validation: validateBatchSequenceToVideo(state.batchSequenceToVideo),
      };
    default:
      throw new Error('Unknown workflow.');
  }
}

export function buildWorkflowSteps(
  validation: ValidationState,
  activity: ActivityState
): WorkflowStepState[] {
  const renderDone = activity.success === true && !activity.running;

  if (!validation.sourceReady) {
    return [
      { key: 'source', label: 'Source', status: 'current' },
      { key: 'parameters', label: 'Parameters', status: 'future' },
      { key: 'output', label: 'Output', status: 'future' },
      { key: 'render', label: 'Render', status: 'future' },
    ];
  }

  if (!validation.parametersReady) {
    return [
      { key: 'source', label: 'Source', status: 'done' },
      { key: 'parameters', label: 'Parameters', status: 'current' },
      { key: 'output', label: 'Output', status: 'future' },
      { key: 'render', label: 'Render', status: 'future' },
    ];
  }

  if (!validation.outputReady) {
    return [
      { key: 'source', label: 'Source', status: 'done' },
      { key: 'parameters', label: 'Parameters', status: 'done' },
      { key: 'output', label: 'Output', status: 'current' },
      { key: 'render', label: 'Render', status: 'future' },
    ];
  }

  if (renderDone) {
    return [
      { key: 'source', label: 'Source', status: 'done' },
      { key: 'parameters', label: 'Parameters', status: 'done' },
      { key: 'output', label: 'Output', status: 'done' },
      { key: 'render', label: 'Render', status: 'done' },
    ];
  }

  return [
    { key: 'source', label: 'Source', status: 'done' },
    { key: 'parameters', label: 'Parameters', status: 'done' },
    { key: 'output', label: 'Output', status: 'done' },
    { key: 'render', label: 'Render', status: 'current' },
  ];
}

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
    return 'Review timing and format settings in the sidebar to continue.';
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
      case 'batch-video-to-sequence':
        return 'Batch source is ready. Review extraction settings and output location.';
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
    case 'batch-video-to-sequence':
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
    case 'batch-video-to-sequence':
      return state.batchVideoToSequence.sourceMode === 'files'
        ? (state.batchVideoToSequence.videoPaths?.length ?? 0) > 0
          ? `${state.batchVideoToSequence.videoPaths?.length ?? 0} files`
          : 'Awaiting input'
        : state.batchVideoToSequence.scanRoot?.trim()
          ? `Scan ${basenameLabel(state.batchVideoToSequence.scanRoot)}`
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

export function getFooterStatus(activity: ActivityState): {
  label: string;
  dotClass: string;
} {
  if (activity.running) {
    return {
      label: 'Processing',
      dotClass: 'bg-amber-400',
    };
  }
  if (activity.success === false) {
    return {
      label: 'Error',
      dotClass: 'bg-rose-400',
    };
  }
  if (activity.success === true) {
    return {
      label: 'Done',
      dotClass: 'bg-emerald-400',
    };
  }
  return {
    label: 'Idle',
    dotClass: 'bg-slate-500',
  };
}

function validateSequenceToVideo(job: WorkflowJobsState['sequenceToVideo']): ValidationState {
  const sourceReady =
    job.sourceMode === 'folder'
      ? Boolean(job.sequenceFolder?.trim())
      : (job.imagePaths?.length ?? 0) > 0;
  const parametersReady = isValidFps(job.fps) && isValidSpeed(job.speed);
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
  const prefixReady = Boolean(job.prefix.trim());
  const numberingReady = Number.isFinite(job.startNumber) && job.startNumber >= 0;
  const parametersReady = rateReady && prefixReady && numberingReady;
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
  if (!prefixReady) {
    blocking.push('Enter a frame prefix.');
  }
  if (!numberingReady) {
    blocking.push('Set a start number of 0 or higher.');
  }

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
  const rateReady = isValidFps(job.fps) && isValidSpeed(job.speed);
  const prefixReady = Boolean(job.prefix.trim());
  const numberingReady = Number.isFinite(job.startNumber) && job.startNumber >= 0;
  const parametersReady = rateReady && prefixReady && numberingReady;
  const outputReady = job.outputMode === 'for-each' || Boolean(job.outputRoot?.trim());
  const blocking: string[] = [];

  if (!sourceReady) {
    blocking.push(
      job.sourceMode === 'files'
        ? 'Select at least one video file to continue.'
        : 'Choose a root folder to scan.'
    );
  }
  if (!isValidFps(job.fps)) {
    blocking.push('Set FPS between 1 and 120.');
  }
  if (!isValidSpeed(job.speed)) {
    blocking.push('Set speed between 0.25 and 8.');
  }
  if (!prefixReady) {
    blocking.push('Enter a frame prefix.');
  }
  if (!numberingReady) {
    blocking.push('Set a start number of 0 or higher.');
  }
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

function validateBatchSequenceToVideo(
  job: WorkflowJobsState['batchSequenceToVideo']
): ValidationState {
  const sourceReady =
    job.sourceMode === 'folders'
      ? (job.sequenceFolders?.length ?? 0) > 0
      : Boolean(job.scanRoot?.trim());
  const parametersReady = isValidFps(job.fps) && isValidSpeed(job.speed);
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
