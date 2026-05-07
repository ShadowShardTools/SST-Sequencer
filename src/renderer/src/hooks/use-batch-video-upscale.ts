import type { BatchVideoUpscaleJob } from '../../../shared/jobs';
import type { UpscalerType } from '../../../shared/upscalers/registry';
import { initialBatchVideoUpscale } from '../features/workflows/defaults';
import { useUpscalerJobState } from './use-upscaler-job-state';
import {
  createBatchVideoSourceActions,
  createFolderOutputAction,
} from './workflow-actions';

export function useBatchVideoUpscaleWorkflow(options: {
  supportedUpscalers: readonly UpscalerType[];
  fallbackUpscaler: UpscalerType;
}) {
  const [job, setJob] = useUpscalerJobState(initialBatchVideoUpscale, options);
  const { pickVideoFiles, pickScanRoot } = createBatchVideoSourceActions<BatchVideoUpscaleJob>(
    setJob
  );
  const pickOutputRoot = createFolderOutputAction<BatchVideoUpscaleJob, 'outputRoot'>(
    setJob,
    'outputRoot'
  );

  return {
    job,
    setJob,
    pickVideoFiles,
    pickScanRoot,
    pickOutputRoot,
  };
}
