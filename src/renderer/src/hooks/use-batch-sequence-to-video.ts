import type { BatchSequenceToVideoJob } from '../../../shared/jobs';
import type { UpscalerType } from '../../../shared/upscalers/registry';
import { initialBatchSequenceToVideo } from '../features/workflows/defaults';
import { useUpscalerJobState } from './use-upscaler-job-state';
import {
  createBatchSequenceSourceActions,
  createFolderOutputAction,
} from './workflow-actions';

export function useBatchSequenceToVideoWorkflow(options: {
  supportedUpscalers: readonly UpscalerType[];
  fallbackUpscaler: UpscalerType;
}) {
  const [job, setJob] = useUpscalerJobState(initialBatchSequenceToVideo, options);
  const { pickSequenceFolders, pickScanRoot } =
    createBatchSequenceSourceActions<BatchSequenceToVideoJob>(setJob);
  const pickOutputRoot = createFolderOutputAction<BatchSequenceToVideoJob, 'outputRoot'>(
    setJob,
    'outputRoot'
  );

  return {
    job,
    setJob,
    pickSequenceFolders,
    pickScanRoot,
    pickOutputRoot,
  };
}
