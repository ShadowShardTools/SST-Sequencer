import { useState } from 'react';
import type { SequenceToVideoJob } from '../../../shared/jobs';
import type { UpscalerType } from '../../../shared/upscalers/registry';
import { initialSequenceToVideo } from '../features/workflows/defaults';
import type { DropNotice } from '../components/fields';
import { useSequenceMotionPreview } from './use-sequence-motion-preview';
import { useSequenceSourcePreview } from './use-sequence-source-preview';
import { useUpscalerJobState } from './use-upscaler-job-state';
import {
  createSequenceSourceActions,
  createVideoOutputAction,
} from './workflow-actions';

export function useSequenceToVideoWorkflow(options: {
  supportedUpscalers: readonly UpscalerType[];
  fallbackUpscaler: UpscalerType;
  previewEnabled: boolean;
}) {
  const [job, setJob] = useUpscalerJobState(initialSequenceToVideo, options);
  const [dropNotice, setDropNotice] = useState<DropNotice | null>(null);
  const [previewRequestKey, setPreviewRequestKey] = useState(0);
  const preview = useSequenceSourcePreview(job);
  const motionPreview = useSequenceMotionPreview({
    enabled: options.previewEnabled,
    requestKey: previewRequestKey,
    sourceMode: job.sourceMode,
    sequenceFolder: job.sequenceFolder,
    imagePaths: job.imagePaths,
    fps: job.fps,
    speed: job.speed,
    resolutionMode: job.resolutionMode,
    customWidth: job.customWidth,
    customHeight: job.customHeight,
  });
  const { pickSequenceFolder, pickSequenceImages, handleSourceDrop } =
    createSequenceSourceActions<SequenceToVideoJob>(setJob, setDropNotice);
  const pickOutputVideo = createVideoOutputAction<SequenceToVideoJob>(
    job,
    setJob,
    job.sourceMode === 'folder' ? job.sequenceFolder : job.imagePaths?.[0]
  );

  function requestMotionPreview(): void {
    setPreviewRequestKey((current) => current + 1);
  }

  return {
    job,
    setJob,
    dropNotice,
    setDropNotice,
    preview,
    motionPreview,
    pickSequenceFolder,
    pickSequenceImages,
    pickOutputVideo,
    handleSourceDrop,
    requestMotionPreview,
  };
}
