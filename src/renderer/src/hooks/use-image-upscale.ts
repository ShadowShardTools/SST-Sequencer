import { useState } from 'react';
import type { ImageUpscaleJob } from '../../../shared/jobs';
import type { UpscalerType } from '../../../shared/upscalers/registry';
import { initialImageUpscale } from '../features/workflows/defaults';
import type { DropNotice } from '../components/fields';
import { useSequenceSourcePreview } from './use-sequence-source-preview';
import { useUpscalerJobState } from './use-upscaler-job-state';
import {
  createFolderOutputAction,
  createImageSourceActions,
} from './workflow-actions';

export function useImageUpscaleWorkflow(options: {
  supportedUpscalers: readonly UpscalerType[];
  fallbackUpscaler: UpscalerType;
}) {
  const [job, setJob] = useUpscalerJobState(initialImageUpscale, options);
  const [dropNotice, setDropNotice] = useState<DropNotice | null>(null);
  const preview = useSequenceSourcePreview({
    sourceMode: 'images',
    sequenceFolder: '',
    imagePaths: job.imagePaths,
  });
  const { pickImages, handleSourceDrop } = createImageSourceActions<ImageUpscaleJob>(
    setJob,
    setDropNotice
  );
  const pickOutputFolder = createFolderOutputAction<ImageUpscaleJob, 'outputDir'>(
    setJob,
    'outputDir'
  );

  return {
    job,
    setJob,
    dropNotice,
    setDropNotice,
    preview,
    pickImages,
    pickOutputFolder,
    handleSourceDrop,
  };
}
