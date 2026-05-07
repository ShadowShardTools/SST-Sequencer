import { useEffect, useRef, useState } from 'react';
import { isValidFps, isValidSpeed } from '../../../shared/formats';
import type { SequenceToVideoJob } from '../../../shared/jobs';
import type { VideoSourcePreview } from '../../../shared/previews';

type SequenceMotionPreviewParams = Pick<
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
};

export function useSequenceMotionPreview(
  params: SequenceMotionPreviewParams
): {
  preview: VideoSourcePreview | null;
  loading: boolean;
  error: string | null;
} {
  const {
    enabled,
    requestKey,
    sourceMode,
    sequenceFolder,
    imagePaths,
    fps,
    speed,
    resolutionMode,
    customWidth,
    customHeight,
  } = params;
  const [preview, setPreview] = useState<VideoSourcePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastHandledRequestKey = useRef(0);
  const canGenerate = canGenerateSequenceMotionPreview({
    enabled,
    sourceMode,
    sequenceFolder,
    imagePaths,
    fps,
    speed,
    resolutionMode,
    customWidth,
    customHeight,
    requestKey,
  });

  useEffect(() => {
    if (!canGenerate) {
      setPreview(null);
      setLoading(false);
      setError(null);
      return;
    }

    setPreview(null);
    setLoading(false);
    setError(null);
  }, [
    canGenerate,
    enabled,
    sourceMode,
    sequenceFolder,
    imagePaths,
    fps,
    speed,
    resolutionMode,
    customWidth,
    customHeight,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (
      requestKey <= 0 ||
      requestKey === lastHandledRequestKey.current ||
      !canGenerate
    ) {
      return;
    }

    lastHandledRequestKey.current = requestKey;
    setLoading(true);
    setError(null);

    void window.mediaApi
      .generateSequencePreview({
        sourceMode,
        sequenceFolder,
        imagePaths,
        fps,
        speed,
        resolutionMode,
        customWidth,
        customHeight,
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
    requestKey,
    canGenerate,
    enabled,
    sourceMode,
    sequenceFolder,
    imagePaths,
    fps,
    speed,
    resolutionMode,
    customWidth,
    customHeight,
  ]);

  return {
    preview,
    loading,
    error,
  };
}

function canGenerateSequenceMotionPreview(params: SequenceMotionPreviewParams): boolean {
  return Boolean(
    params.enabled &&
      ((params.sourceMode === 'folder' && params.sequenceFolder?.trim()) ||
        (params.imagePaths?.length ?? 0) > 0) &&
      isValidFps(params.fps) &&
      isValidSpeed(params.speed)
  );
}
