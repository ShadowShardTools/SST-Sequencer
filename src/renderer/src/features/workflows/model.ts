import type { TabId, WorkflowJobsState, WorkflowViewModel } from './types';
import { workflowMeta } from './workflow-meta';
export {
  buildWorkflowSteps,
  getFooterStatus,
} from './workflow-status';
export {
  getPrimaryActionHint,
  getPrimaryActionHintTone,
  getSourceBadgeLabel,
  getSourceHelperText,
  getTopHelperText,
  getTopHelperTone,
} from './workflow-copy';
import { validateWorkflow } from './workflow-validation';

export function buildWorkflowViewModel(
  activeTab: TabId,
  state: WorkflowJobsState
): WorkflowViewModel {
  const meta = workflowMeta.find((item) => item.id === activeTab);
  if (!meta) {
    throw new Error('Unknown workflow.');
  }

  const validation = validateWorkflow(activeTab, state);

  switch (activeTab) {
    case 'sequence-to-video':
      return { request: state.sequenceToVideo, meta, validation };
    case 'video-to-sequence':
      return { request: state.videoToSequence, meta, validation };
    case 'batch-video-to-sequence':
      return { request: state.batchVideoToSequence, meta, validation };
    case 'batch-image-upscale':
      return { request: state.batchImageUpscale, meta, validation };
    case 'batch-video-upscale':
      return { request: state.batchVideoUpscale, meta, validation };
    case 'image-upscale':
      return { request: state.imageUpscale, meta, validation };
    case 'video-upscale':
      return { request: state.videoUpscale, meta, validation };
    case 'batch-sequence-to-video':
      return { request: state.batchSequenceToVideo, meta, validation };
    default:
      throw new Error('Unknown workflow.');
  }
}
