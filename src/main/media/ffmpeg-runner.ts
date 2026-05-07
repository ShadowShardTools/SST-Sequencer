import { spawn } from 'node:child_process';
import { ensureBinaryAvailable, ffmpegBinary } from './binaries';
import type { JobEmitter } from './types';

export type FfmpegRunOptions = {
  args: string[];
  expectedDurationSeconds?: number;
  onProgress?: (percent: number) => void;
  emitter: JobEmitter;
};

export async function runFfmpeg(options: FfmpegRunOptions): Promise<void> {
  await ensureBinaryAvailable(ffmpegBinary, 'FFmpeg');

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBinary, options.args, {
      windowsHide: true,
    });

    const stderrTail: string[] = [];
    let remainder = '';
    let lastReportedPercent = -1;

    child.stderr.on('data', (chunk: Buffer) => {
      remainder += chunk.toString('utf8').replace(/\r/g, '\n');
      const segments = remainder.split('\n');
      remainder = segments.pop() ?? '';

      for (const segment of segments) {
        const line = segment.trim();
        if (!line) {
          continue;
        }

        stderrTail.push(line);
        if (stderrTail.length > 30) {
          stderrTail.shift();
        }

        const match = /time=(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/.exec(line);
        if (match && options.expectedDurationSeconds && options.expectedDurationSeconds > 0) {
          const seconds = parseTimestamp(match[1]);
          const percent = clamp((seconds / options.expectedDurationSeconds) * 100, 0, 99);
          const rounded = Math.floor(percent);

          if (rounded > lastReportedPercent) {
            lastReportedPercent = rounded;
            options.onProgress?.(rounded);
          }
        }

        if (/error|invalid|failed/i.test(line)) {
          options.emitter.log(line, 'error');
        }
      }
    });

    child.on('error', (error) => reject(error));

    child.on('close', (code) => {
      if (code === 0) {
        options.onProgress?.(100);
        resolve();
      } else {
        reject(
          new Error(
            stderrTail.slice(-8).join(' | ') || `FFmpeg exited with code ${code ?? 'unknown'}.`
          )
        );
      }
    });
  });
}

function parseTimestamp(value: string): number {
  const [hours, minutes, seconds] = value.split(':');
  return (
    Number.parseInt(hours, 10) * 3600 +
    Number.parseInt(minutes, 10) * 60 +
    Number.parseFloat(seconds)
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
