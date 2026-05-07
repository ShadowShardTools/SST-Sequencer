import type { BatchVideoToSequenceJob } from '../../../shared/jobs';
import type { UpscalerType } from '../../../shared/upscalers/registry';
import { initialBatchVideoToSequence } from '../features/workflows/defaults';
import { useUpscalerJobState } from './use-upscaler-job-state';
import {
  createBatchVideoSourceActions,
  createFolderOutputAction,
} from './workflow-actions';

export function useBatchVideoToSequenceWorkflow(options: {
  supportedUpscalers: readonly UpscalerType[];
  fallbackUpscaler: UpscalerType;
}) {
  const [job, setJob] = useUpscalerJobState(initialBatchVideoToSequence, options);
  const { pickVideoFiles, pickScanRoot } = createBatchVideoSourceActions<BatchVideoToSequenceJob>(
    setJob
  );
  const pickOutputRoot = createFolderOutputAction<BatchVideoToSequenceJob, 'outputRoot'>(
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
