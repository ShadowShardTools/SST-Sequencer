import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SequenceToVideoJob, JobEvent } from '../shared/jobs';

vi.mock('./jobs/sequence-to-video', async () => {
  const { throwIfJobCancelled } = await import('./media/job-runtime');

  return {
    runSequenceToVideoJob: vi.fn(async () => {
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 1));
        throwIfJobCancelled();
      }
    }),
  };
});

import { cancelMediaJob, runMediaJob } from './media-service';

const backgroundRemoveDefaults = {
  backgroundRemove: false,
  backgroundRemoveModel: 'u2net' as const,
};

function createSequenceToVideoJob(): SequenceToVideoJob {
  return {
    kind: 'sequence-to-video',
    sourceMode: 'folder',
    sequenceFolder: 'D:\\frames',
    imagePaths: [],
    outputPath: 'D:\\out\\clip.mp4',
    fps: 24,
    speed: 1,
    quality: 100,
    ...backgroundRemoveDefaults,
    resolutionMode: 'source',
    customWidth: 1920,
    customHeight: 1080,
    upscaleMode: 'off',
    alphaMode: 'auto',
    upscalerConfig: { kind: 'realesrgan', model: 'realesrgan-x4plus' },
    format: 'mp4-h264',
  };
}

function createSender() {
  return {
    send: vi.fn(),
    isDestroyed: vi.fn(() => false),
  };
}

async function waitForStartedJobId(sender: ReturnType<typeof createSender>): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const startedCall = sender.send.mock.calls.find((call) => {
      const channel = call[0];
      const payload = call[1] as JobEvent | undefined;
      return channel === 'jobs:event' && payload?.kind === 'started';
    }) as [string, Extract<JobEvent, { kind: 'started' }>] | undefined;

    if (startedCall) {
      return startedCall[1].jobId;
    }

    await new Promise((resolve) => setTimeout(resolve, 2));
  }

  throw new Error('Timed out waiting for started job event.');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('media-service cancellation', () => {
  it('cancels active jobs and reports a cancelled summary', async () => {
    const sender = createSender();
    const jobPromise = runMediaJob(sender as never, createSequenceToVideoJob());
    const jobId = await waitForStartedJobId(sender);

    await expect(cancelMediaJob(jobId)).resolves.toBe(true);

    const result = await jobPromise;

    expect(result.success).toBe(false);
    expect(result.summary).toEqual({
      headline: 'Job cancelled.',
      outputs: [],
      completed: 0,
      failed: 0,
      failures: [],
    });
    expect(sender.send).toHaveBeenCalledWith(
      'jobs:event',
      expect.objectContaining({
        jobId,
        kind: 'finished',
        success: false,
        message: 'Job cancelled.',
      })
    );
  });

  it('returns false when cancel is requested for an unknown job', async () => {
    await expect(cancelMediaJob('missing-job-id')).resolves.toBe(false);
  });
});
