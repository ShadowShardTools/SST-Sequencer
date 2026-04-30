import type { JobSummary } from '../../shared/jobs';

export type JobEmitter = {
  started: (message: string) => void;
  log: (message: string, level?: 'info' | 'error') => void;
  progress: (
    percent: number,
    message: string,
    meta?: {
      currentItem?: string;
      overallIndex?: number;
      overallTotal?: number;
    }
  ) => void;
  finished: (success: boolean, message: string, summary: JobSummary) => void;
};
