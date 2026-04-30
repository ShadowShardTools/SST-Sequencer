import { useEffect, useState } from 'react';
import { isValidFps, isValidSpeed } from '../../../shared/formats';
import type { JobRequest, JobSummary, SequenceToVideoJob } from '../../../shared/jobs';
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
    'sourceMode' | 'sequenceFolder' | 'imagePaths' | 'fps' | 'speed'
  > & {
    enabled: boolean;
  }
): {
  preview: VideoSourcePreview | null;
  loading: boolean;
  error: string | null;
} {
  const [preview, setPreview] = useState<VideoSourcePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

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

    setLoading(true);
    setError(null);
    const timeoutId = window.setTimeout(() => {
      void window.mediaApi
        .generateSequencePreview({
          sourceMode: params.sourceMode,
          sequenceFolder: params.sequenceFolder,
          imagePaths: params.imagePaths,
          fps: params.fps,
          speed: params.speed,
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
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    params.enabled,
    params.sourceMode,
    params.sequenceFolder,
    params.imagePaths,
    params.fps,
    params.speed,
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

export function useRenderedVideoPreview(params: {
  requestKind?: JobRequest['kind'];
  success?: boolean;
  summary?: JobSummary;
}): VideoSourcePreview | null {
  const [preview, setPreview] = useState<VideoSourcePreview | null>(null);

  useEffect(() => {
    let cancelled = false;

    const outputPath =
      params.requestKind === 'sequence-to-video' && params.success === true
        ? params.summary?.outputs?.[0]
        : undefined;

    if (!outputPath?.trim()) {
      setPreview(null);
      return;
    }

    void window.mediaApi
      .inspectVideoSource(outputPath)
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
  }, [params.requestKind, params.success, params.summary]);

  return preview;
}
