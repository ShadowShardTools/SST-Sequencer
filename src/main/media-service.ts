import { randomUUID } from 'node:crypto';
import type { JobEvent, JobRequest, JobResult, JobSummary } from '../shared/jobs';
import {
  runBatchImageUpscaleJob,
} from './jobs/batch-image-upscale';
import {
  runBatchSequenceToVideoJob,
} from './jobs/batch-sequence-to-video';
import {
  runBatchVideoUpscaleJob,
} from './jobs/batch-video-upscale';
import {
  runBatchVideoToSequenceJob,
} from './jobs/batch-video-to-sequence';
import { getErrorMessage } from './jobs/job-helpers';
import { runImageUpscaleJob } from './jobs/image-upscale';
import { runSequenceToVideoJob } from './jobs/sequence-to-video';
import { runVideoToSequenceJob } from './jobs/video-to-sequence';
import { runVideoUpscaleJob } from './jobs/video-upscale';
import type { JobEmitter } from './media/types';

export {
  generateSequencePreview,
  inspectSequenceSource,
  inspectVideoSource,
} from './media/previews';

const JOB_EVENT_CHANNEL = 'jobs:event';

export async function runMediaJob(
  sender: Electron.WebContents,
  request: JobRequest
): Promise<JobResult> {
  const jobId = randomUUID();
  const emitter = createEmitter(sender, jobId);
  emitter.started(getStartMessage(request));

  try {
    const summary = await executeJob(request, emitter);
    const success = summary.failed === 0;
    emitter.finished(success, summary.headline, summary);

    return {
      jobId,
      success,
      summary,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    const summary: JobSummary = {
      headline: message,
      outputs: [],
      completed: 0,
      failed: 1,
      failures: [
        {
          source: getFailureSource(request),
          reason: message,
        },
      ],
    };

    emitter.log(message, 'error');
    emitter.finished(false, message, summary);

    return {
      jobId,
      success: false,
      summary,
    };
  }
}

async function executeJob(request: JobRequest, emitter: JobEmitter): Promise<JobSummary> {
  switch (request.kind) {
    case 'sequence-to-video':
      return runSequenceToVideoJob(request, emitter);
    case 'video-to-sequence':
      return runVideoToSequenceJob(request, emitter);
    case 'image-upscale':
      return runImageUpscaleJob(request, emitter);
    case 'video-upscale':
      return runVideoUpscaleJob(request, emitter);
    case 'batch-image-upscale':
      return runBatchImageUpscaleJob(request, emitter);
    case 'batch-video-upscale':
      return runBatchVideoUpscaleJob(request, emitter);
    case 'batch-video-to-sequence':
      return runBatchVideoToSequenceJob(request, emitter);
    case 'batch-sequence-to-video':
      return runBatchSequenceToVideoJob(request, emitter);
    default:
      throw new Error('Unsupported job type.');
  }
}

function createEmitter(sender: Electron.WebContents, jobId: string): JobEmitter {
  return {
    started: (message) => sendJobEvent(sender, { jobId, kind: 'started', message }),
    log: (message, level = 'info') => sendJobEvent(sender, { jobId, kind: 'log', level, message }),
    progress: (percent, message, meta) =>
      sendJobEvent(sender, {
        jobId,
        kind: 'progress',
        percent: clamp(percent, 0, 100),
        message,
        currentItem: meta?.currentItem,
        overallIndex: meta?.overallIndex,
        overallTotal: meta?.overallTotal,
      }),
    finished: (success, message, summary) =>
      sendJobEvent(sender, {
        jobId,
        kind: 'finished',
        success,
        message,
        summary,
      }),
  };
}

function sendJobEvent(sender: Electron.WebContents, event: JobEvent): void {
  if (!sender.isDestroyed()) {
    sender.send(JOB_EVENT_CHANNEL, event);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getStartMessage(request: JobRequest): string {
  switch (request.kind) {
    case 'sequence-to-video':
      return 'Starting image-sequence to video job.';
    case 'video-to-sequence':
      return 'Starting video to image-sequence job.';
    case 'image-upscale':
      return 'Starting image upscale job.';
    case 'video-upscale':
      return 'Starting video upscale job.';
    case 'batch-image-upscale':
      return 'Starting batch image upscale job.';
    case 'batch-video-upscale':
      return 'Starting batch video upscale job.';
    case 'batch-video-to-sequence':
      return 'Starting batch video to image-sequence job.';
    case 'batch-sequence-to-video':
      return 'Starting batch image-sequence to video job.';
    default:
      return 'Starting media job.';
  }
}

function getFailureSource(request: JobRequest): string {
  switch (request.kind) {
    case 'sequence-to-video':
      return request.sequenceFolder ?? request.imagePaths?.[0] ?? 'sequence-to-video';
    case 'video-to-sequence':
      return request.videoPath ?? 'video-to-sequence';
    case 'image-upscale':
      return request.imagePaths?.[0] ?? 'image-upscale';
    case 'video-upscale':
      return request.videoPath ?? 'video-upscale';
    case 'batch-image-upscale':
      return request.scanRoot ?? request.imagePaths?.[0] ?? 'batch-image-upscale';
    case 'batch-video-upscale':
      return request.scanRoot ?? request.videoPaths?.[0] ?? 'batch-video-upscale';
    case 'batch-video-to-sequence':
      return request.scanRoot ?? request.videoPaths?.[0] ?? 'batch-video-to-sequence';
    case 'batch-sequence-to-video':
      return request.scanRoot ?? request.sequenceFolders?.[0] ?? 'batch-sequence-to-video';
    default:
      return 'media-job';
  }
}
