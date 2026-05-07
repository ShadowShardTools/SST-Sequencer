import type {
  AlphaMode,
  BackgroundRemoveModel,
  BatchOutputMode,
  BatchImageSourceMode,
  BatchSequenceSourceMode,
  BatchVideoSourceMode,
  ImageFormat,
  SequenceInputMode,
  UpscaleMode,
  UpscalerConfig,
  VideoFormat,
} from './formats';
import type { ResolutionMode } from './resolution';

type UpscaleSettings = {
  upscaleMode: UpscaleMode;
  alphaMode: AlphaMode;
  upscalerConfig: UpscalerConfig;
};

type BackgroundRemoveSettings = {
  backgroundRemove: boolean;
  backgroundRemoveModel: BackgroundRemoveModel;
};

type ResolutionSettings = {
  resolutionMode: ResolutionMode;
  customWidth?: number;
  customHeight?: number;
};

export interface SequenceToVideoJob
  extends UpscaleSettings,
    BackgroundRemoveSettings,
    ResolutionSettings {
  kind: 'sequence-to-video';
  sourceMode: SequenceInputMode;
  sequenceFolder?: string;
  imagePaths?: string[];
  outputPath?: string;
  fps: number;
  speed: number;
  quality: number;
  format: VideoFormat;
}

export interface VideoToSequenceJob
  extends UpscaleSettings,
    BackgroundRemoveSettings,
    ResolutionSettings {
  kind: 'video-to-sequence';
  videoPath?: string;
  outputDir?: string;
  fps: number;
  speed: number;
  quality: number;
  format: ImageFormat;
  prefix: string;
  startNumber: number;
}

export interface ImageUpscaleJob
  extends UpscaleSettings,
    BackgroundRemoveSettings,
    ResolutionSettings {
  kind: 'image-upscale';
  imagePaths?: string[];
  outputDir?: string;
  quality: number;
  format: ImageFormat;
}

export interface VideoUpscaleJob
  extends UpscaleSettings,
    BackgroundRemoveSettings,
    ResolutionSettings {
  kind: 'video-upscale';
  videoPath?: string;
  outputPath?: string;
  quality: number;
  format: VideoFormat;
}

export interface BatchImageUpscaleJob
  extends UpscaleSettings,
    BackgroundRemoveSettings,
    ResolutionSettings {
  kind: 'batch-image-upscale';
  sourceMode: BatchImageSourceMode;
  imagePaths?: string[];
  scanRoot?: string;
  recursive: boolean;
  outputMode: BatchOutputMode;
  outputRoot?: string;
  quality: number;
  format: ImageFormat;
}

export interface BatchVideoUpscaleJob
  extends UpscaleSettings,
    BackgroundRemoveSettings,
    ResolutionSettings {
  kind: 'batch-video-upscale';
  sourceMode: BatchVideoSourceMode;
  videoPaths?: string[];
  scanRoot?: string;
  recursive: boolean;
  outputMode: BatchOutputMode;
  outputRoot?: string;
  quality: number;
  format: VideoFormat;
}

export interface BatchVideoToSequenceJob
  extends UpscaleSettings,
    BackgroundRemoveSettings,
    ResolutionSettings {
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

export interface BatchSequenceToVideoJob
  extends UpscaleSettings,
    BackgroundRemoveSettings,
    ResolutionSettings {
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
  | ImageUpscaleJob
  | VideoUpscaleJob
  | BatchImageUpscaleJob
  | BatchVideoUpscaleJob
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
