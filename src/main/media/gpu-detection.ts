import { join } from 'node:path';
import { spawnManaged } from './job-runtime';

let cachedNvidiaGpuCheckPromise: Promise<boolean> | null = null;

export async function hasNvidiaGpu(): Promise<boolean> {
  if (!cachedNvidiaGpuCheckPromise) {
    cachedNvidiaGpuCheckPromise = detectNvidiaGpu();
  }

  return cachedNvidiaGpuCheckPromise;
}

async function detectNvidiaGpu(): Promise<boolean> {
  const commands =
    process.platform === 'win32'
      ? [
          { command: 'nvidia-smi', args: ['-L'] },
          {
            command: join(
              process.env['ProgramW6432'] || process.env['ProgramFiles'] || 'C:\\Program Files',
              'NVIDIA Corporation',
              'NVSMI',
              'nvidia-smi.exe'
            ),
            args: ['-L'],
          },
        ]
      : [{ command: 'nvidia-smi', args: ['-L'] }];

  for (const candidate of commands) {
    if (await canRunCommand(candidate.command, candidate.args)) {
      return true;
    }
  }

  return false;
}

async function canRunCommand(command: string, args: string[]): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawnManaged(command, args, {
        windowsHide: true,
        stdio: 'ignore',
      });

      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`${command} exited with code ${code ?? 'unknown'}.`));
      });
    });
    return true;
  } catch {
    return false;
  }
}
