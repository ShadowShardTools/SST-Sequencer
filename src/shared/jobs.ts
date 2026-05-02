import type {
  AlphaMode,
  BatchOutputMode,
  BatchSequenceSourceMode,
  BatchVideoSourceMode,
  ImageFormat,
  SequenceInputMode,
  UpscaleMode,
  UpscalerType,
  VideoFormat,
} from './formats';
import type { ResolutionMode } from './resolution';

export interface SequenceToVideoJob {
  kind: 'sequence-to-video';
  sourceMode: SequenceInputMode;
  sequenceFolder?: string;
  imagePaths?: string[];
  outputPath?: string;
  fps: number;
  speed: number;
  quality: number;
  resolutionMode: ResolutionMode;
  customWidth?: number;
  customHeight?: number;
  upscaler: UpscalerType;
  upscaleMode: UpscaleMode;
  alphaMode: AlphaMode;
  format: VideoFormat;
}

export interface VideoToSequenceJob {
  kind: 'video-to-sequence';
  videoPath?: string;
  outputDir?: string;
  fps: number;
  speed: number;
  quality: number;
  resolutionMode: ResolutionMode;
  customWidth?: number;
  customHeight?: number;
  upscaler: UpscalerType;
  upscaleMode: UpscaleMode;
  alphaMode: AlphaMode;
  format: ImageFormat;
  prefix: string;
  startNumber: number;
}

export interface BatchVideoToSequenceJob {
  kind: 'batch-video-to-sequence';
  sourceMode: BatchVideoSourceMode;
  videoPaths?: string[];
  scanRoot?: string;
  recursive: boolean;
  outputMode: BatchOutputMode;
  outputRoot?: string;
  overrideFps: boolean;
  fps: number;
  speed: number;
  quality: number;
  format: ImageFormat;
  prefix: string;
  startNumber: number;
}

export interface BatchSequenceToVideoJob {
  kind: 'batch-sequence-to-video';
  sourceMode: BatchSequenceSourceMode;
  sequenceFolders?: string[];
  scanRoot?: string;
  recursive: boolean;
  outputMode: BatchOutputMode;
  outputRoot?: string;
  fps: number;
  speed: number;
  quality: number;
  format: VideoFormat;
}

export type JobRequest =
  | SequenceToVideoJob
  | VideoToSequenceJob
  | BatchVideoToSequenceJob
  | BatchSequenceToVideoJob;

export interface JobFailure {
  source: string;
  reason: string;
}

export interface JobSummary {
  headline: string;
  outputs: string[];
  completed: number;
  failed: number;
  failures: JobFailure[];
}

export interface JobResult {
  jobId: string;
  success: boolean;
  summary: JobSummary;
}

export type JobEvent =
  | {
      jobId: string;
      kind: 'started';
      message: string;
    }
  | {
      jobId: string;
      kind: 'log';
      level: 'info' | 'error';
      message: string;
    }
  | {
      jobId: string;
      kind: 'progress';
      percent: number;
      message: string;
      currentItem?: string;
      overallIndex?: number;
      overallTotal?: number;
    }
  | {
      jobId: string;
      kind: 'finished';
      success: boolean;
      message: string;
      summary: JobSummary;
    };
