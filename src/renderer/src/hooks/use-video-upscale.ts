import { useState } from 'react';
import type { VideoUpscaleJob } from '../../../shared/jobs';
import type { UpscalerType } from '../../../shared/upscalers/registry';
import { initialVideoUpscale } from '../features/workflows/defaults';
import type { DropNotice } from '../components/fields';
import { useVideoSourcePreview } from './use-video-source-preview';
import { useUpscalerJobState } from './use-upscaler-job-state';
import {
  createSingleVideoSourceActions,
  createVideoOutputAction,
} from './workflow-actions';

export function useVideoUpscaleWorkflow(options: {
  supportedUpscalers: readonly UpscalerType[];
  fallbackUpscaler: UpscalerType;
}) {
  const [job, setJob] = useUpscalerJobState(initialVideoUpscale, options);
  const [dropNotice, setDropNotice] = useState<DropNotice | null>(null);
  const preview = useVideoSourcePreview(job.videoPath);
  const { pickVideo, handleSourceDrop } = createSingleVideoSourceActions<VideoUpscaleJob>(
    setJob,
    setDropNotice
  );
  const pickOutputVideo = createVideoOutputAction<VideoUpscaleJob>(job, setJob, job.videoPath);

  return {
    job,
    setJob,
    dropNotice,
    setDropNotice,
    preview,
    pickVideo,
    pickOutputVideo,
    handleSourceDrop,
  };
}
