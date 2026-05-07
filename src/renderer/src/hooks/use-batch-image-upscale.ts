import type { BatchImageUpscaleJob } from '../../../shared/jobs';
import type { UpscalerType } from '../../../shared/upscalers/registry';
import { initialBatchImageUpscale } from '../features/workflows/defaults';
import { useUpscalerJobState } from './use-upscaler-job-state';
import {
  createBatchImageSourceActions,
  createFolderOutputAction,
} from './workflow-actions';

export function useBatchImageUpscaleWorkflow(options: {
  supportedUpscalers: readonly UpscalerType[];
  fallbackUpscaler: UpscalerType;
}) {
  const [job, setJob] = useUpscalerJobState(initialBatchImageUpscale, options);
  const { pickImageFiles, pickScanRoot } = createBatchImageSourceActions<BatchImageUpscaleJob>(setJob);
  const pickOutputRoot = createFolderOutputAction<BatchImageUpscaleJob, 'outputRoot'>(
    setJob,
    'outputRoot'
  );

  return {
    job,
    setJob,
    pickImageFiles,
    pickScanRoot,
    pickOutputRoot,
  };
}
