import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { RATE_LIMITS } from '../../../shared/formats';
import type { VideoSourcePreview } from '../../../shared/previews';

type FpsJob = {
  videoPath?: string;
  fps: number;
};

type SetJob<T> = Dispatch<SetStateAction<T>>;
type SetFpsTouched = Dispatch<SetStateAction<boolean>>;

export function useDetectedVideoFps<T extends FpsJob>(
  preview: VideoSourcePreview | null,
  fpsTouched: boolean,
  setFpsTouched: SetFpsTouched,
  setJob: SetJob<T>,
  activeVideoPath: string | undefined
) {
  useEffect(() => {
    setFpsTouched(false);
  }, [activeVideoPath, setFpsTouched]);

  useEffect(() => {
    if (!preview?.videoPath || !preview.frameRate || fpsTouched) {
      return;
    }

    const detectedFps = clampDetectedFps(preview.frameRate);
    setJob((current) =>
      current.videoPath === preview.videoPath && current.fps !== detectedFps
        ? {
            ...current,
            fps: detectedFps,
          }
        : current
    );
  }, [preview, fpsTouched, setJob]);
}

function clampDetectedFps(value: number): number {
  const rounded = Math.round(value * 1000) / 1000;
  return Math.min(RATE_LIMITS.fps.max, Math.max(RATE_LIMITS.fps.min, rounded));
}
