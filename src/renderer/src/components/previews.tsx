import { useEffect, useState } from 'react';
import type { SequenceToVideoJob } from '../../../shared/jobs';
import type { SequenceSourcePreview, VideoSourcePreview } from '../../../shared/previews';
import { isDisplayableImagePath } from '../lib/file-types';
import { formatDuration, formatResolution, getVideoAspectRatio } from '../lib/formatters';
import { trimNumber } from '../lib/numeric';
import { basenameLabel, getExtension, getParentDirectory } from '../lib/path-utils';

export function SequencePreviewStrip(props: {
  preview: SequenceSourcePreview;
  fps: number;
  sourceMode: SequenceToVideoJob['sourceMode'];
  sourceLabel?: string;
  onClear: () => void;
}) {
  const displayLabel =
    props.sourceMode === 'folder'
      ? basenameLabel(props.sourceLabel || getParentDirectory(props.preview.firstFramePath))
      : basenameLabel(props.sourceLabel || props.preview.firstFramePath);

  return (
    <div className="rounded-[8px] border border-white/8 bg-[#101117] p-3">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/8 pb-3">
        <div>
          <div className="text-sm font-semibold text-white">Preview</div>
          <div className="text-sm text-slate-400">First frame and detected sequence details.</div>
        </div>
        <button
          type="button"
          onClick={props.onClear}
          className="secondary-button rounded-[8px] px-3 py-1.5 text-sm font-medium"
        >
          Clear
        </button>
      </div>

      <div className="flex items-start gap-3">
        <PreviewThumbnail path={props.preview.firstFramePath} sizeClass="h-[88px] w-[88px]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{displayLabel}</div>
          <div className="mt-2 grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
            <PreviewMetaItem label="Frames" value={String(props.preview.frameCount)} />
            <PreviewMetaItem
              label="Resolution"
              value={formatResolution(props.preview.width, props.preview.height) || 'Unknown'}
            />
            <PreviewMetaItem label="Frame rate" value={`${trimNumber(props.fps)} fps`} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function VideoPreviewStrip(props: { preview: VideoSourcePreview; onClear: () => void }) {
  return (
    <div className="rounded-[8px] border border-white/8 bg-[#101117] p-3">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/8 pb-3">
        <div>
          <div className="text-sm font-semibold text-white">Preview</div>
          <div className="text-sm text-slate-400">Detected video details and first frame.</div>
        </div>
        <button
          type="button"
          onClick={props.onClear}
          className="secondary-button rounded-[8px] px-3 py-1.5 text-sm font-medium"
        >
          Clear
        </button>
      </div>

      <div className="flex items-start gap-3">
        <VideoPreviewThumbnail path={props.preview.videoPath} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">
            {basenameLabel(props.preview.videoPath)}
          </div>
          <div className="mt-2 grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
            <PreviewMetaItem
              label="Resolution"
              value={formatResolution(props.preview.width, props.preview.height) || 'Unknown'}
            />
            <PreviewMetaItem
              label="Frame rate"
              value={
                props.preview.frameRate ? `${trimNumber(props.preview.frameRate)} fps` : 'Unknown'
              }
            />
            <PreviewMetaItem
              label="Duration"
              value={
                props.preview.durationSeconds
                  ? formatDuration(props.preview.durationSeconds)
                  : 'Unknown'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SequenceMotionPreview(props: {
  preview: VideoSourcePreview | null;
  loading: boolean;
  error: string | null;
  canGenerate: boolean;
  onGenerate: () => void;
  onClear: () => void;
}) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoLoadFailed, setVideoLoadFailed] = useState(false);
  const aspectRatio = props.preview ? getVideoAspectRatio(props.preview) : '16 / 9';
  const actionLabel = props.preview ? 'Refresh preview' : 'Generate preview';

  useEffect(() => {
    let cancelled = false;
    const previewPath = props.preview?.videoPath;

    if (!previewPath) {
      setVideoSrc(null);
      setVideoLoadFailed(false);
      return;
    }

    setVideoSrc(null);
    setVideoLoadFailed(false);

    void window.mediaApi
      .loadVideoPreview(previewPath)
      .then((previewData) => {
        if (!cancelled) {
          if (previewData) {
            setVideoSrc(previewData);
          } else {
            setVideoLoadFailed(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVideoLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [props.preview?.videoPath]);

  return (
    <div className="rounded-[8px] border border-white/8 bg-[#101117] p-3">
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-white/8 pb-3">
        <div>
          <div className="text-sm font-semibold text-white">Motion preview</div>
          <div className="text-sm text-slate-400">
            Generate a short preview clip when you want to check playback.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onGenerate}
            disabled={!props.canGenerate || props.loading}
            className="secondary-button rounded-[8px] px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {props.loading ? 'Building...' : actionLabel}
          </button>
          {props.preview && (
            <button
              type="button"
              onClick={props.onClear}
              className="secondary-button rounded-[8px] px-3 py-1.5 text-sm font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {props.loading && (
        <div className="flex min-h-[220px] items-center justify-center rounded-[8px] border border-white/8 bg-black/20 text-sm text-slate-400">
          Building preview...
        </div>
      )}

      {!props.loading && props.error && (
        <div className="rounded-[8px] border border-rose-400/20 bg-rose-400/8 px-3 py-2 text-sm text-rose-200">
          {props.error}
        </div>
      )}

      {!props.loading && !props.error && !props.preview && (
        <div className="rounded-[8px] border border-white/8 bg-black/20 px-3 py-8 text-center text-sm text-slate-400">
          Preview generation is manual to avoid rebuilding a temporary clip on every source or
          timing change.
        </div>
      )}

      {!props.loading && !props.error && props.preview && (
        <div className="space-y-3">
          {videoSrc ? (
            <div className="w-full max-w-[520px]">
              <video
                key={props.preview.videoPath}
                src={videoSrc}
                controls
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                className="w-full rounded-[8px] border border-white/8 bg-black object-contain"
                style={{ aspectRatio }}
              />
            </div>
          ) : videoLoadFailed ? (
            <div className="rounded-[8px] border border-rose-400/20 bg-black/20 px-3 py-10 text-sm text-rose-200">
              Preview clip was generated, but the embedded player could not load it.
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-[8px] border border-white/8 bg-black/20 text-sm text-slate-400">
              Loading preview player...
            </div>
          )}

          <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-4">
            <PreviewMetaItem
              label="Resolution"
              value={formatResolution(props.preview.width, props.preview.height) || 'Unknown'}
            />
            <PreviewMetaItem
              label="Frame rate"
              value={
                props.preview.frameRate ? `${trimNumber(props.preview.frameRate)} fps` : 'Unknown'
              }
            />
            <PreviewMetaItem
              label="Duration"
              value={
                props.preview.durationSeconds
                  ? formatDuration(props.preview.durationSeconds)
                  : 'Unknown'
              }
            />
            <PreviewMetaItem label="Scope" value="Preview clip" />
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewThumbnail(props: { path: string; sizeClass?: string }) {
  const sizeClass = props.sizeClass ?? 'h-[68px] w-[68px]';
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!isDisplayableImagePath(props.path)) {
      setImageSrc(null);
      setFailed(false);
      return;
    }

    setImageSrc(null);
    setFailed(false);

    void window.mediaApi
      .loadImagePreview(props.path)
      .then((preview) => {
        if (!cancelled) {
          if (preview) {
            setImageSrc(preview);
          } else {
            setFailed(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [props.path]);

  if (!isDisplayableImagePath(props.path) || failed) {
    return (
      <div
        className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-[8px] border border-white/8 bg-white/[0.03] text-xs font-semibold uppercase tracking-[0.14em] text-slate-400`}
      >
        {getExtension(props.path).replace('.', '') || 'IMG'}
      </div>
    );
  }

  if (!imageSrc) {
    return (
      <div
        className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-[8px] border border-white/8 bg-white/[0.03] text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500`}
      >
        Loading
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt="First frame preview"
      className={`${sizeClass} shrink-0 rounded-[8px] border border-white/8 object-cover`}
    />
  );
}

function VideoPreviewThumbnail(props: { path: string }) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (isDisplayableImagePath(props.path)) {
      setVideoSrc(null);
      setFailed(false);
      return;
    }

    setVideoSrc(null);
    setFailed(false);

    void window.mediaApi
      .loadVideoPreview(props.path)
      .then((preview) => {
        if (!cancelled) {
          if (preview) {
            setVideoSrc(preview);
          } else {
            setFailed(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [props.path]);

  if (isDisplayableImagePath(props.path)) {
    return <PreviewThumbnail path={props.path} sizeClass="h-[88px] w-[88px]" />;
  }

  if (failed) {
    return (
      <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-[8px] border border-white/8 bg-white/[0.03] text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {getExtension(props.path).replace('.', '') || 'VID'}
      </div>
    );
  }

  if (!videoSrc) {
    return (
      <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-[8px] border border-white/8 bg-white/[0.03] text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
        Loading
      </div>
    );
  }

  return (
    <video
      src={videoSrc}
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={(event) => {
        const element = event.currentTarget;
        if (Number.isFinite(element.duration) && element.duration > 0) {
          element.currentTime = Math.min(0.08, element.duration / 2);
        }
      }}
      className="h-[88px] w-[88px] shrink-0 rounded-[8px] border border-white/8 bg-black object-cover"
    />
  );
}

function PreviewMetaItem(props: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-white/6 bg-white/[0.02] px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
        {props.label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-100">{props.value}</div>
    </div>
  );
}
