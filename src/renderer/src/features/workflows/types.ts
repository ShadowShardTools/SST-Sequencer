import type {
  BatchSequenceToVideoJob,
  BatchVideoToSequenceJob,
  JobRequest,
  JobSummary,
  SequenceToVideoJob,
  VideoToSequenceJob,
} from '../../../../shared/jobs';

export type TabId =
  | 'sequence-to-video'
  | 'video-to-sequence'
  | 'batch-video-to-sequence'
  | 'batch-sequence-to-video';

export type WorkflowCategory = 'Single' | 'Batch';
export type SingleTabId = 'sequence-to-video' | 'video-to-sequence';
export type BatchTabId = 'batch-video-to-sequence' | 'batch-sequence-to-video';

export type ActivityState = {
  running: boolean;
  jobId?: string;
  requestKind?: JobRequest['kind'];
  percent: number;
  message: string;
  currentItem?: string;
  overallIndex?: number;
  overallTotal?: number;
  logs: string[];
  success?: boolean;
  summary?: JobSummary;
};

export type WorkflowMeta = {
  id: TabId;
  title: string;
  strap: string;
  category: WorkflowCategory;
  runLabel: string;
};

export type ValidationState = {
  ready: boolean;
  blocking: string[];
  sourceReady: boolean;
  parametersReady: boolean;
  outputReady: boolean;
};

export type WorkflowViewModel = {
  request: JobRequest;
  meta: WorkflowMeta;
  validation: ValidationState;
};

export type WorkflowJobsState = {
  sequenceToVideo: SequenceToVideoJob;
  videoToSequence: VideoToSequenceJob;
  batchVideoToSequence: BatchVideoToSequenceJob;
  batchSequenceToVideo: BatchSequenceToVideoJob;
};
