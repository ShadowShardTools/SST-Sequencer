import { useEffect, useRef, useState } from 'react';
import { isValidFps, isValidSpeed } from '../../../shared/formats';
import type { SequenceToVideoJob } from '../../../shared/jobs';
import type { SequenceSourcePreview, VideoSourcePreview } from '../../../shared/previews';

export function useSequenceSourcePreview(
  job: Pick<SequenceToVideoJob, 'sourceMode' | 'sequenceFolder' | 'imagePaths'>
): SequenceSourcePreview | null {
  const [preview, setPreview] = useState<SequenceSourcePreview | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!job.sequenceFolder?.trim() && (job.imagePaths?.length ?? 0) === 0) {
      setPreview(null);
      return;
    }

    void window.mediaApi
      .inspectSequenceSource({
        sourceMode: job.sourceMode,
        sequenceFolder: job.sequenceFolder,
        imagePaths: job.imagePaths,
      })
      .then((nextPreview) => {
        if (!cancelled) {
          setPreview(nextPreview);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [job.sourceMode, job.sequenceFolder, job.imagePaths]);

  return preview;
}

export function useSequenceMotionPreview(
  params: Pick<
    SequenceToVideoJob,
    | 'sourceMode'
    | 'sequenceFolder'
    | 'imagePaths'
    | 'fps'
    | 'speed'
    | 'resolutionMode'
    | 'customWidth'
    | 'customHeight'
  > & {
    enabled: boolean;
    requestKey: number;
  }
): {
  preview: VideoSourcePreview | null;
  loading: boolean;
  error: string | null;
} {
  const [preview, setPreview] = useState<VideoSourcePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastHandledRequestKey = useRef(0);

  useEffect(() => {
    if (
      !params.enabled ||
      !(
        (params.sourceMode === 'folder' && params.sequenceFolder?.trim()) ||
        (params.imagePaths?.length ?? 0) > 0
      ) ||
      !isValidFps(params.fps) ||
      !isValidSpeed(params.speed)
    ) {
      setPreview(null);
      setLoading(false);
      setError(null);
      return;
    }

    setPreview(null);
    setLoading(false);
    setError(null);
  }, [
    params.enabled,
    params.sourceMode,
    params.sequenceFolder,
    params.imagePaths,
    params.fps,
    params.speed,
    params.resolutionMode,
    params.customWidth,
    params.customHeight,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (
      params.requestKey <= 0 ||
      params.requestKey === lastHandledRequestKey.current ||
      !params.enabled ||
      !(
        (params.sourceMode === 'folder' && params.sequenceFolder?.trim()) ||
        (params.imagePaths?.length ?? 0) > 0
      ) ||
      !isValidFps(params.fps) ||
      !isValidSpeed(params.speed)
    ) {
      return;
    }

    lastHandledRequestKey.current = params.requestKey;
    setLoading(true);
    setError(null);

    void window.mediaApi
      .generateSequencePreview({
        sourceMode: params.sourceMode,
        sequenceFolder: params.sequenceFolder,
        imagePaths: params.imagePaths,
        fps: params.fps,
        speed: params.speed,
        resolutionMode: params.resolutionMode,
        customWidth: params.customWidth,
        customHeight: params.customHeight,
      })
      .then((nextPreview) => {
        if (!cancelled) {
          setPreview(nextPreview);
          setLoading(false);
          setError(nextPreview ? null : 'Preview unavailable for this source.');
        }
      })
      .catch((previewError) => {
        if (!cancelled) {
          setPreview(null);
          setLoading(false);
          setError(
            previewError instanceof Error ? previewError.message : 'Preview generation failed.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    params.requestKey,
    params.enabled,
    params.sourceMode,
    params.sequenceFolder,
    params.imagePaths,
    params.fps,
    params.speed,
    params.resolutionMode,
    params.customWidth,
    params.customHeight,
  ]);

  return {
    preview,
    loading,
    error,
  };
}

export function useVideoSourcePreview(videoPath: string | undefined): VideoSourcePreview | null {
  const [preview, setPreview] = useState<VideoSourcePreview | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!videoPath?.trim()) {
      setPreview(null);
      return;
    }

    void window.mediaApi
      .inspectVideoSource(videoPath)
      .then((nextPreview) => {
        if (!cancelled) {
          setPreview(nextPreview);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [videoPath]);

  return preview;
}
