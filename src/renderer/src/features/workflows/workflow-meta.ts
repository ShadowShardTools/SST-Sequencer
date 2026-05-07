import type { WorkflowMeta } from './types';

export const workflowMeta: WorkflowMeta[] = [
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
    id: 'image-upscale',
    title: 'Image Upscale',
    strap: 'Upscale one or more still images directly.',
    category: 'Single',
    runLabel: 'Upscale images',
  },
  {
    id: 'video-upscale',
    title: 'Video Upscale',
    strap: 'Upscale one video directly and re-export it.',
    category: 'Single',
    runLabel: 'Upscale video',
  },
  {
    id: 'batch-video-to-sequence',
    title: 'Batch Videos to Sequences',
    strap: 'Process many videos in one batch.',
    category: 'Batch',
    runLabel: 'Run batch extraction',
  },
  {
    id: 'batch-image-upscale',
    title: 'Batch Image Upscale',
    strap: 'Upscale many still images in one batch.',
    category: 'Batch',
    runLabel: 'Run batch image upscale',
  },
  {
    id: 'batch-video-upscale',
    title: 'Batch Video Upscale',
    strap: 'Upscale many videos in one batch.',
    category: 'Batch',
    runLabel: 'Run batch video upscale',
  },
  {
    id: 'batch-sequence-to-video',
    title: 'Batch Sequences to Videos',
    strap: 'Encode many sequence folders in one pass.',
    category: 'Batch',
    runLabel: 'Run batch encode',
  },
];
