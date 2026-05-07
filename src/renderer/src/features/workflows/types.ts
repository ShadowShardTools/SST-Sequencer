import type {
  BatchImageUpscaleJob,
  BatchSequenceToVideoJob,
  BatchVideoToSequenceJob,
  BatchVideoUpscaleJob,
  ImageUpscaleJob,
  JobRequest,
  JobSummary,
  SequenceToVideoJob,
  VideoUpscaleJob,
  VideoToSequenceJob,
} from '../../../../shared/jobs';

export type TabId =
  | 'sequence-to-video'
  | 'video-to-sequence'
  | 'image-upscale'
  | 'video-upscale'
  | 'batch-image-upscale'
  | 'batch-video-upscale'
  | 'batch-video-to-sequence'
  | 'batch-sequence-to-video';

export type WorkflowCategory = 'Single' | 'Batch';
export type SingleTabId = 'sequence-to-video' | 'video-to-sequence' | 'image-upscale' | 'video-upscale';
export type BatchTabId =
  | 'batch-video-to-sequence'
  | 'batch-sequence-to-video'
  | 'batch-image-upscale'
  | 'batch-video-upscale';

export type ActivityState = {
  running: boolean;
  cancelRequested?: boolean;
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
  imageUpscale: ImageUpscaleJob;
  videoUpscale: VideoUpscaleJob;
  batchImageUpscale: BatchImageUpscaleJob;
  batchVideoUpscale: BatchVideoUpscaleJob;
  batchVideoToSequence: BatchVideoToSequenceJob;
  batchSequenceToVideo: BatchSequenceToVideoJob;
};
