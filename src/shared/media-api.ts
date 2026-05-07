import type { SequenceInputMode, UpscalerType, VideoFormat } from './formats';
import type { JobEvent, JobRequest, JobResult } from './jobs';
import type { SequenceSourcePreview, VideoSourcePreview } from './previews';
import type { ResolutionMode } from './resolution';

export interface MediaRuntimeInfo {
  platform: NodeJS.Platform;
  supportedUpscalers: ReadonlyArray<UpscalerType>;
}

export interface MediaApi {
  getRuntimeInfo(): MediaRuntimeInfo;
  pickImageFiles(): Promise<string[]>;
  pickSequenceFolders(): Promise<string[]>;
  pickVideoFiles(): Promise<string[]>;
  pickFolder(): Promise<string | null>;
  saveVideoFile(defaultName: string, format: VideoFormat): Promise<string | null>;
  inspectSequenceSource(input: {
    sourceMode: SequenceInputMode;
    sequenceFolder?: string;
    imagePaths?: string[];
  }): Promise<SequenceSourcePreview | null>;
  generateSequencePreview(input: {
    sourceMode: SequenceInputMode;
    sequenceFolder?: string;
    imagePaths?: string[];
    fps: number;
    speed: number;
    resolutionMode: ResolutionMode;
    customWidth?: number;
    customHeight?: number;
  }): Promise<VideoSourcePreview | null>;
  inspectVideoSource(videoPath: string): Promise<VideoSourcePreview | null>;
  loadImagePreview(filePath: string): Promise<string | null>;
  loadVideoPreview(filePath: string): Promise<string | null>;
  savePastedImage(input: { data: Uint8Array; mimeType: string }): Promise<string | null>;
  getPathForDroppedFile(file: File): string;
  revealPath(targetPath: string): Promise<void>;
  runJob(request: JobRequest): Promise<JobResult>;
  cancelJob(jobId: string): Promise<boolean>;
  onJobEvent(listener: (event: JobEvent) => void): () => void;
}
