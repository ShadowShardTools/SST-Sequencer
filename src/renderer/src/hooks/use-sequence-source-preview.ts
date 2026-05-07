import { useEffect, useState } from 'react';
import type { SequenceToVideoJob } from '../../../shared/jobs';
import type { SequenceSourcePreview } from '../../../shared/previews';

export function useSequenceSourcePreview(
  job: Pick<SequenceToVideoJob, 'sourceMode' | 'sequenceFolder' | 'imagePaths'>
): SequenceSourcePreview | null {
  const [preview, setPreview] = useState<SequenceSourcePreview | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!hasSequenceSource(job.sourceMode, job.sequenceFolder, job.imagePaths)) {
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

function hasSequenceSource(
  sourceMode: SequenceToVideoJob['sourceMode'],
  sequenceFolder: string | undefined,
  imagePaths: string[] | undefined
): boolean {
  return Boolean(
    (sourceMode === 'folder' && sequenceFolder?.trim()) || (imagePaths?.length ?? 0) > 0
  );
}
