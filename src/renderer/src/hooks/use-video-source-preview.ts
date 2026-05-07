import { useEffect, useState } from 'react';
import type { VideoSourcePreview } from '../../../shared/previews';

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
