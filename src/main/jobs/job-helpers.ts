import { basename } from 'node:path';
import { rm } from 'node:fs/promises';
import type { JobFailure, JobSummary } from '../../shared/jobs';
import { probeMediaInfo } from '../media/ffprobe';
import type { JobEmitter } from '../media/types';

export function buildBatchSummary(
  outputs: string[],
  failures: JobFailure[],
  successHeadline: string,
  emptyHeadline: string
): JobSummary {
  if (outputs.length === 0) {
    return {
      headline: buildEmptyOutputHeadline(failures, emptyHeadline, successHeadline),
      outputs,
      completed: 0,
      failed: failures.length,
      failures,
    };
  }

  return {
    headline: `${successHeadline}. Completed ${outputs.length}, failed ${failures.length}.`,
    outputs,
    completed: outputs.length,
    failed: failures.length,
    failures,
  };
}

function buildEmptyOutputHeadline(
  failures: JobFailure[],
  emptyHeadline: string,
  successHeadline: string
): string {
  if (failures.length === 0) {
    return successHeadline;
  }

  if (failures.length === 1) {
    return failures[0].reason;
  }

  const firstReason = failures[0]?.reason?.trim();
  if (!firstReason) {
    return `All ${failures.length} items failed.`;
  }

  return `All ${failures.length} items failed. First error: ${firstReason}`;
}

export function scaleBatchPercent(index: number, total: number, itemPercent: number): number {
  return ((index - 1 + itemPercent / 100) / total) * 100;
}

export async function resolveBatchVideoSourceFps(
  videoPath: string,
  fallbackFps: number,
  emitter: JobEmitter
): Promise<number> {
  const safeFallbackFps =
    Number.isFinite(fallbackFps) && fallbackFps >= 1 && fallbackFps <= 120 ? fallbackFps : 24;

  try {
    const mediaInfo = await probeMediaInfo(videoPath);
    if (mediaInfo.frameRate && Number.isFinite(mediaInfo.frameRate) && mediaInfo.frameRate > 0) {
      return Math.round(mediaInfo.frameRate * 1000) / 1000;
    }
  } catch (error) {
    emitter.log(
      `Could not detect source FPS for ${basename(videoPath)}. Falling back to ${safeFallbackFps} fps: ${getErrorMessage(error)}`,
      'error'
    );
    return safeFallbackFps;
  }

  emitter.log(
    `Could not detect source FPS for ${basename(videoPath)}. Falling back to ${safeFallbackFps} fps.`,
    'error'
  );
  return safeFallbackFps;
}

export function resolveUpscaledResize(
  baseResize: { width: number; height: number } | undefined,
  sourceWidth: number | undefined,
  sourceHeight: number | undefined,
  upscaleFactor: number
): { width: number; height: number } | undefined {
  if (baseResize) {
    return {
      width: baseResize.width * upscaleFactor,
      height: baseResize.height * upscaleFactor,
    };
  }

  if (!sourceWidth || !sourceHeight) {
    return undefined;
  }

  return {
    width: sourceWidth * upscaleFactor,
    height: sourceHeight * upscaleFactor,
  };
}

export async function removeTemporaryDirectories(...dirs: Array<string | undefined>): Promise<void> {
  await Promise.all(
    dirs
      .filter((dir): dir is string => Boolean(dir))
      .map((dir) => rm(dir, { recursive: true, force: true }))
  );
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'The media operation failed for an unknown reason.';
}
