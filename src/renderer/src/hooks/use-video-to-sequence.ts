import { useState } from 'react';
import type { VideoToSequenceJob } from '../../../shared/jobs';
import type { UpscalerType } from '../../../shared/upscalers/registry';
import { initialVideoToSequence } from '../features/workflows/defaults';
import type { DropNotice } from '../components/fields';
import { useVideoSourcePreview } from './use-video-source-preview';
import { useUpscalerJobState } from './use-upscaler-job-state';
import { useDetectedVideoFps } from './use-detected-video-fps';
import {
  createFolderOutputAction,
  createSingleVideoSourceActions,
} from './workflow-actions';

export function useVideoToSequenceWorkflow(options: {
  supportedUpscalers: readonly UpscalerType[];
  fallbackUpscaler: UpscalerType;
}) {
  const [job, setJob] = useUpscalerJobState(initialVideoToSequence, options);
  const [dropNotice, setDropNotice] = useState<DropNotice | null>(null);
  const [fpsTouched, setFpsTouched] = useState(false);
  const preview = useVideoSourcePreview(job.videoPath);
  const { pickVideo: pickSingleVideo, handleSourceDrop } =
    createSingleVideoSourceActions<VideoToSequenceJob>(setJob, setDropNotice);
  const pickOutputFolder = createFolderOutputAction<VideoToSequenceJob, 'outputDir'>(
    setJob,
    'outputDir'
  );

  useDetectedVideoFps<VideoToSequenceJob>(preview, fpsTouched, setFpsTouched, setJob, job.videoPath);

  return {
    job,
    setJob,
    dropNotice,
    setDropNotice,
    fpsTouched,
    setFpsTouched,
    preview,
    pickSingleVideo,
    pickOutputFolder,
    handleSourceDrop,
  };
}
