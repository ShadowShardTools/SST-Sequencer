import type {
  BatchSequenceToVideoJob,
  BatchVideoToSequenceJob,
  SequenceToVideoJob,
  VideoToSequenceJob,
} from '../../../../shared/jobs';
import type { WorkflowCategory } from './types';

export const modeMeta: Array<{
  id: WorkflowCategory;
  title: string;
}> = [
  {
    id: 'Single',
    title: 'Single',
  },
  {
    id: 'Batch',
    title: 'Batch',
  },
];

export const initialSequenceToVideo: SequenceToVideoJob = {
  kind: 'sequence-to-video',
  sourceMode: 'folder',
  sequenceFolder: '',
  imagePaths: [],
  outputPath: '',
  fps: 24,
  speed: 1,
  quality: 100,
  resolutionMode: 'source',
  customWidth: 1920,
  customHeight: 1080,
  upscaler: 'realesrgan-anime-video',
  upscaleMode: 'off',
  epxAntialias: false,
  alphaMode: 'auto',
  format: 'mp4-h264',
};

export const initialVideoToSequence: VideoToSequenceJob = {
  kind: 'video-to-sequence',
  videoPath: '',
  outputDir: '',
  fps: 24,
  speed: 1,
  quality: 100,
  resolutionMode: 'source',
  customWidth: 1920,
  customHeight: 1080,
  upscaler: 'realesrgan-anime-video',
  upscaleMode: 'off',
  epxAntialias: false,
  alphaMode: 'auto',
  format: 'png',
  prefix: 'frame',
  startNumber: 1,
};

export const initialBatchVideoToSequence: BatchVideoToSequenceJob = {
  kind: 'batch-video-to-sequence',
  sourceMode: 'files',
  videoPaths: [],
  scanRoot: '',
  recursive: true,
  outputMode: 'for-each',
  outputRoot: '',
  overrideFps: false,
  fps: 24,
  speed: 1,
  quality: 100,
  upscaler: 'realesrgan-anime-video',
  upscaleMode: 'off',
  epxAntialias: false,
  alphaMode: 'auto',
  format: 'png',
  prefix: 'frame',
  startNumber: 1,
};

export const initialBatchSequenceToVideo: BatchSequenceToVideoJob = {
  kind: 'batch-sequence-to-video',
  sourceMode: 'folders',
  sequenceFolders: [],
  scanRoot: '',
  recursive: true,
  outputMode: 'for-each',
  outputRoot: '',
  fps: 24,
  speed: 1,
  quality: 100,
  upscaler: 'realesrgan-anime-video',
  upscaleMode: 'off',
  epxAntialias: false,
  alphaMode: 'auto',
  format: 'mp4-h264',
};
