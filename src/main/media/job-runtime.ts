import { AsyncLocalStorage } from 'node:async_hooks';
import type { ChildProcess, ChildProcessWithoutNullStreams, SpawnOptions } from 'node:child_process';
import { spawn } from 'node:child_process';

export class JobCancelledError extends Error {
  constructor(message = 'Job cancelled.') {
    super(message);
    this.name = 'JobCancelledError';
  }
}

export type JobRuntime = {
  jobId: string;
  cancelled: boolean;
  children: Set<ChildProcess>;
};

const jobRuntimeStorage = new AsyncLocalStorage<JobRuntime>();

export function createJobRuntime(jobId: string): JobRuntime {
  return {
    jobId,
    cancelled: false,
    children: new Set(),
  };
}

export function runWithJobRuntime<T>(runtime: JobRuntime, task: () => Promise<T>): Promise<T> {
  return jobRuntimeStorage.run(runtime, task);
}

export function getCurrentJobRuntime(): JobRuntime | undefined {
  return jobRuntimeStorage.getStore();
}

export function isCurrentJobCancelled(): boolean {
  return Boolean(jobRuntimeStorage.getStore()?.cancelled);
}

export function throwIfJobCancelled(): void {
  if (isCurrentJobCancelled()) {
    throw new JobCancelledError();
  }
}

export function isJobCancelledError(error: unknown): error is JobCancelledError {
  return error instanceof JobCancelledError;
}

export function spawnManaged(
  command: string,
  args: readonly string[],
  options?: SpawnOptions
): ChildProcessWithoutNullStreams {
  throwIfJobCancelled();

  const child = spawn(command, args, options ?? {}) as ChildProcessWithoutNullStreams;
  const runtime = getCurrentJobRuntime();
  if (!runtime) {
    return child;
  }

  runtime.children.add(child);
  const cleanup = (): void => {
    runtime.children.delete(child);
  };

  child.once('exit', cleanup);
  child.once('error', cleanup);

  return child;
}

export async function cancelJobRuntime(runtime: JobRuntime): Promise<void> {
  runtime.cancelled = true;
  await Promise.allSettled([...runtime.children].map((child) => terminateChildProcessTree(child)));
}

async function terminateChildProcessTree(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (!pid) {
    return;
  }

  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore',
      });

      killer.on('error', () => {
        try {
          child.kill();
        } catch {
          // Ignore process-kill races during cancellation.
        }
        resolve();
      });
      killer.on('close', () => resolve());
    });
    return;
  }

  try {
    child.kill('SIGTERM');
  } catch {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 150));
  try {
    process.kill(pid, 0);
    process.kill(pid, 'SIGKILL');
  } catch {
    // Process already exited.
  }
}
