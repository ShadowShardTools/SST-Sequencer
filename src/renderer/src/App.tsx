import { startTransition, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { getDefaultUpscalerForPlatform, getSupportedUpscalerOptions } from '../../shared/upscalers/registry';
import { resolveResolution } from '../../shared/resolution';
import type { JobEvent } from '../../shared/jobs';
import { CompactSegmentGroup, Panel } from './components/shell';
import { useBatchImageUpscaleWorkflow } from './hooks/use-batch-image-upscale';
import { useBatchSequenceToVideoWorkflow } from './hooks/use-batch-sequence-to-video';
import { useBatchVideoUpscaleWorkflow } from './hooks/use-batch-video-upscale';
import { useBatchVideoToSequenceWorkflow } from './hooks/use-batch-video-to-sequence';
import { useImageUpscaleWorkflow } from './hooks/use-image-upscale';
import { useSequenceToVideoWorkflow } from './hooks/use-sequence-to-video';
import { useVideoToSequenceWorkflow } from './hooks/use-video-to-sequence';
import { useVideoUpscaleWorkflow } from './hooks/use-video-upscale';
import { sortNaturalPaths } from './lib/path-utils';
import { estimateVideoSizeNote } from './lib/quality';
import { modeMeta } from './features/workflows/defaults';
import {
  buildWorkflowViewModel,
  getFooterStatus,
  getPrimaryActionHint,
  getPrimaryActionHintTone,
  getSourceBadgeLabel,
  getSourceHelperText,
  getTopHelperText,
  getTopHelperTone,
} from './features/workflows/model';
import { WorkflowParameterFields } from './features/workflows/parameter-sections';
import { WorkflowSourceSection } from './features/workflows/source-sections';
import type {
  ActivityState,
  BatchTabId,
  SingleTabId,
  TabId,
  WorkflowCategory,
} from './features/workflows/types';

export default function App() {
  const [runtimeInfo] = useState(() => window.mediaApi.getRuntimeInfo());
  const [activeMode, setActiveMode] = useState<WorkflowCategory>('Single');
  const [activeSingleTab, setActiveSingleTab] = useState<SingleTabId>('image-upscale');
  const [activeBatchTab, setActiveBatchTab] = useState<BatchTabId>('batch-image-upscale');
  const [activity, setActivity] = useState<ActivityState>({
    running: false,
    percent: 0,
    message: 'Choose a workflow, load a source, then run the job.',
    logs: [],
  });

  const fallbackUpscaler = getDefaultUpscalerForPlatform(runtimeInfo.platform);
  const activeTab: TabId = activeMode === 'Single' ? activeSingleTab : activeBatchTab;
  const supportedUpscalerOptions = useMemo(
    () =>
      getSupportedUpscalerOptions(runtimeInfo.platform).filter((option) =>
        runtimeInfo.supportedUpscalers.includes(option.value)
      ),
    [runtimeInfo]
  );

  const sequenceToVideo = useSequenceToVideoWorkflow({
    supportedUpscalers: runtimeInfo.supportedUpscalers,
    fallbackUpscaler,
    previewEnabled: activeTab === 'sequence-to-video',
  });
  const videoToSequence = useVideoToSequenceWorkflow({
    supportedUpscalers: runtimeInfo.supportedUpscalers,
    fallbackUpscaler,
  });
  const imageUpscale = useImageUpscaleWorkflow({
    supportedUpscalers: runtimeInfo.supportedUpscalers,
    fallbackUpscaler,
  });
  const videoUpscale = useVideoUpscaleWorkflow({
    supportedUpscalers: runtimeInfo.supportedUpscalers,
    fallbackUpscaler,
  });
  const batchVideoToSequence = useBatchVideoToSequenceWorkflow({
    supportedUpscalers: runtimeInfo.supportedUpscalers,
    fallbackUpscaler,
  });
  const batchImageUpscale = useBatchImageUpscaleWorkflow({
    supportedUpscalers: runtimeInfo.supportedUpscalers,
    fallbackUpscaler,
  });
  const batchVideoUpscale = useBatchVideoUpscaleWorkflow({
    supportedUpscalers: runtimeInfo.supportedUpscalers,
    fallbackUpscaler,
  });
  const batchSequenceToVideo = useBatchSequenceToVideoWorkflow({
    supportedUpscalers: runtimeInfo.supportedUpscalers,
    fallbackUpscaler,
  });

  const currentWorkflow = buildWorkflowViewModel(activeTab, {
    sequenceToVideo: sequenceToVideo.job,
    videoToSequence: videoToSequence.job,
    imageUpscale: imageUpscale.job,
    videoUpscale: videoUpscale.job,
    batchImageUpscale: batchImageUpscale.job,
    batchVideoUpscale: batchVideoUpscale.job,
    batchVideoToSequence: batchVideoToSequence.job,
    batchSequenceToVideo: batchSequenceToVideo.job,
  });

  const handleJobEvent = useEffectEvent((event: JobEvent) => {
    startTransition(() => {
      setActivity((current) => {
        switch (event.kind) {
          case 'started':
            return {
              running: true,
              cancelRequested: false,
              jobId: event.jobId,
              requestKind: current.requestKind,
              percent: 0,
              message: event.message,
              currentItem: undefined,
              overallIndex: undefined,
              overallTotal: undefined,
              logs: [event.message],
              success: undefined,
              summary: undefined,
            };
          case 'log':
            return {
              ...current,
              logs: [...current.logs, `[${event.level}] ${event.message}`],
            };
          case 'progress':
            return {
              ...current,
              jobId: event.jobId,
              percent: event.percent,
              message: event.message,
              currentItem: event.currentItem,
              overallIndex: event.overallIndex,
              overallTotal: event.overallTotal,
            };
          case 'finished':
            return {
              ...current,
              running: false,
              cancelRequested: false,
              jobId: event.jobId,
              requestKind: current.requestKind,
              percent: event.success ? 100 : current.percent,
              message: event.message,
              success: event.success,
              summary: event.summary,
              logs: [...current.logs, event.message],
            };
          default:
            return current;
        }
      });
    });
  });

  useEffect(() => {
    return window.mediaApi.onJobEvent(handleJobEvent);
  }, []);

  const handlePaste = useEffectEvent(async (event: ClipboardEvent) => {
    if (isEditablePasteTarget(event.target)) {
      return;
    }

    if (
      activeTab !== 'sequence-to-video' &&
      activeTab !== 'image-upscale' &&
      activeTab !== 'batch-image-upscale'
    ) {
      return;
    }

    const clipboardItems = [...(event.clipboardData?.items ?? [])].filter((item) =>
      item.type.startsWith('image/')
    );
    if (clipboardItems.length === 0) {
      return;
    }

    const pastedPaths: string[] = [];
    for (const item of clipboardItems) {
      const file = item.getAsFile();
      if (!file) {
        continue;
      }

      const arrayBuffer = await file.arrayBuffer();
      const savedPath = await window.mediaApi.savePastedImage({
        data: new Uint8Array(arrayBuffer),
        mimeType: file.type || item.type,
      });
      if (savedPath) {
        pastedPaths.push(savedPath);
      }
    }

    if (pastedPaths.length === 0) {
      return;
    }

    event.preventDefault();
    const mergedPaths = sortNaturalPaths([...new Set(pastedPaths)]);

    startTransition(() => {
      switch (activeTab) {
        case 'sequence-to-video':
          sequenceToVideo.setDropNotice(null);
          sequenceToVideo.setJob((current) => ({
            ...current,
            sourceMode: 'images',
            imagePaths: sortNaturalPaths([
              ...new Set([...(current.imagePaths ?? []), ...mergedPaths]),
            ]),
            sequenceFolder: '',
          }));
          break;
        case 'image-upscale':
          imageUpscale.setDropNotice(null);
          imageUpscale.setJob((current) => ({
            ...current,
            imagePaths: sortNaturalPaths([
              ...new Set([...(current.imagePaths ?? []), ...mergedPaths]),
            ]),
          }));
          break;
        case 'batch-image-upscale':
          batchImageUpscale.setJob((current) => ({
            ...current,
            sourceMode: 'files',
            imagePaths: sortNaturalPaths([
              ...new Set([...(current.imagePaths ?? []), ...mergedPaths]),
            ]),
            scanRoot: '',
          }));
          break;
      }
    });
  });

  useEffect(() => {
    const listener = (event: ClipboardEvent) => {
      void handlePaste(event);
    };

    window.addEventListener('paste', listener);
    return () => {
      window.removeEventListener('paste', listener);
    };
  }, []);

  const pipelineOptions =
    activeMode === 'Single'
      ? [
          {
            label: 'Images upscale',
            active: activeSingleTab === 'image-upscale',
            onClick: () => setActiveSingleTab('image-upscale'),
          },
          {
            label: 'Videos upscale',
            active: activeSingleTab === 'video-upscale',
            onClick: () => setActiveSingleTab('video-upscale'),
          },
          {
            label: 'Sequence to video',
            active: activeSingleTab === 'sequence-to-video',
            onClick: () => setActiveSingleTab('sequence-to-video'),
          },
          {
            label: 'Video to sequence',
            active: activeSingleTab === 'video-to-sequence',
            onClick: () => setActiveSingleTab('video-to-sequence'),
          },
        ]
      : [
          {
            label: 'Images upscale',
            active: activeBatchTab === 'batch-image-upscale',
            onClick: () => setActiveBatchTab('batch-image-upscale'),
          },
          {
            label: 'Videos upscale',
            active: activeBatchTab === 'batch-video-upscale',
            onClick: () => setActiveBatchTab('batch-video-upscale'),
          },
          {
            label: 'Sequences to videos',
            active: activeBatchTab === 'batch-sequence-to-video',
            onClick: () => setActiveBatchTab('batch-sequence-to-video'),
          },
          {
            label: 'Videos to sequences',
            active: activeBatchTab === 'batch-video-to-sequence',
            onClick: () => setActiveBatchTab('batch-video-to-sequence'),
          },
        ];

  const canGenerateSequencePreview =
    currentWorkflow.validation.sourceReady &&
    currentWorkflow.validation.parametersReady &&
    activeTab === 'sequence-to-video';

  const singleDropNotice =
    activeTab === 'sequence-to-video'
      ? sequenceToVideo.dropNotice
      : activeTab === 'video-to-sequence'
        ? videoToSequence.dropNotice
        : activeTab === 'image-upscale'
          ? imageUpscale.dropNotice
          : activeTab === 'video-upscale'
            ? videoUpscale.dropNotice
            : null;

  const topHelperText = getTopHelperText(activeTab, currentWorkflow.validation, activity);
  const topHelperTone = getTopHelperTone(currentWorkflow.validation, activity);
  const primaryActionHint = getPrimaryActionHint(currentWorkflow, activity);
  const primaryActionHintTone = getPrimaryActionHintTone(currentWorkflow.validation, activity);
  const sequenceSizeEstimate =
    activeTab === 'sequence-to-video'
      ? estimateVideoSizeNote(
          sequenceToVideo.preview,
          sequenceToVideo.job.fps,
          sequenceToVideo.job.speed,
          sequenceToVideo.job.format,
          sequenceToVideo.job.quality,
          resolveResolution(sequenceToVideo.job, sequenceToVideo.preview ?? {}, {
            enforceEven: true,
          }),
          sequenceToVideo.job.upscaleMode
        )
      : activeTab === 'video-upscale' && videoUpscale.preview?.frameRate
        ? estimateVideoSizeNote(
            {
              firstFramePath: videoUpscale.job.videoPath ?? '',
              frameCount: Math.max(
                1,
                Math.round((videoUpscale.preview.durationSeconds ?? 0) * videoUpscale.preview.frameRate)
              ),
              width: videoUpscale.preview.width,
              height: videoUpscale.preview.height,
              hasAlpha: videoUpscale.preview.hasAlpha,
            },
            videoUpscale.preview.frameRate,
            1,
            videoUpscale.job.format,
            videoUpscale.job.quality,
            resolveResolution(videoUpscale.job, videoUpscale.preview ?? {}, { enforceEven: true }),
            videoUpscale.job.upscaleMode
          )
        : null;
  const sourceBadgeLabel = getSourceBadgeLabel(activeTab, {
    sequenceToVideo: sequenceToVideo.job,
    videoToSequence: videoToSequence.job,
    imageUpscale: imageUpscale.job,
    videoUpscale: videoUpscale.job,
    batchVideoToSequence: batchVideoToSequence.job,
    batchImageUpscale: batchImageUpscale.job,
    batchVideoUpscale: batchVideoUpscale.job,
    batchSequenceToVideo: batchSequenceToVideo.job,
    sequencePreview: sequenceToVideo.preview,
    videoPreview: activeTab === 'video-upscale' ? videoUpscale.preview : videoToSequence.preview,
  });
  const sourceHelperText = getSourceHelperText(activeTab, currentWorkflow.validation);
  const displayTopHelperText = topHelperText === sourceHelperText ? '' : topHelperText;
  const footerStatus = getFooterStatus(activity);

  function generateSequencePreview(): void {
    if (!canGenerateSequencePreview || sequenceToVideo.motionPreview.loading) {
      return;
    }

    sequenceToVideo.requestMotionPreview();
  }

  async function pickBatchOutputRoot(
    kind:
      | 'batch-video-to-sequence'
      | 'batch-sequence-to-video'
      | 'batch-image-upscale'
      | 'batch-video-upscale'
  ): Promise<void> {
    switch (kind) {
      case 'batch-video-to-sequence':
        await batchVideoToSequence.pickOutputRoot();
        return;
      case 'batch-image-upscale':
        await batchImageUpscale.pickOutputRoot();
        return;
      case 'batch-video-upscale':
        await batchVideoUpscale.pickOutputRoot();
        return;
      case 'batch-sequence-to-video':
      default:
        await batchSequenceToVideo.pickOutputRoot();
    }
  }

  async function runCurrentJob(): Promise<void> {
    if (activity.running || !currentWorkflow.validation.ready) {
      return;
    }

    setActivity((current) => ({
      ...current,
      running: true,
      cancelRequested: false,
      requestKind: currentWorkflow.request.kind,
      percent: 0,
      summary: undefined,
      success: undefined,
    }));

    try {
      await window.mediaApi.runJob(currentWorkflow.request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The job failed unexpectedly.';
      setActivity((current) => ({
        ...current,
        running: false,
        cancelRequested: false,
        success: false,
        message,
        logs: [...current.logs, `[error] ${message}`],
      }));
    }
  }

  async function cancelCurrentJob(): Promise<void> {
    if (!activity.running || !activity.jobId || activity.cancelRequested) {
      return;
    }

    setActivity((current) => ({
      ...current,
      cancelRequested: true,
      message: 'Cancelling job...',
    }));

    try {
      const cancelled = await window.mediaApi.cancelJob(activity.jobId);
      if (!cancelled) {
        setActivity((current) => ({
          ...current,
          cancelRequested: false,
          message: 'The active job could not be cancelled.',
          logs: [...current.logs, '[error] The active job could not be cancelled.'],
        }));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The active job could not be cancelled.';
      setActivity((current) => ({
        ...current,
        cancelRequested: false,
        message,
        logs: [...current.logs, `[error] ${message}`],
      }));
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#1a1a1f] text-slate-100">
      <div className="grid h-screen overflow-hidden grid-rows-[minmax(0,1fr)_42px]">
        <div className="grid min-h-0 overflow-hidden grid-cols-[minmax(0,1fr)_392px]">
          <main className="relative z-0 min-h-0 overflow-y-auto">
            <div className="flex min-h-full flex-col gap-3 p-3">
              <Panel className="py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <CompactSegmentGroup
                    label="Mode"
                    options={modeMeta.map((mode) => ({
                      label: mode.title,
                      active: activeMode === mode.id,
                      onClick: () => setActiveMode(mode.id),
                    }))}
                  />
                  <CompactSegmentGroup label="Pipeline" options={pipelineOptions} />
                </div>
              </Panel>

              <Panel className="flex-1">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-[24px] font-semibold tracking-tight text-white">
                        {currentWorkflow.meta.title}
                      </h1>
                      <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-slate-300">
                        {currentWorkflow.meta.category}
                      </span>
                    </div>
                    {displayTopHelperText && (
                      <p
                        className={`text-sm ${
                          topHelperTone === 'warning' ? 'text-amber-300' : 'text-slate-400'
                        }`}
                      >
                        {displayTopHelperText}
                      </p>
                    )}
                  </div>

                  <WorkflowSourceSection
                    activeTab={activeTab}
                    badge={sourceBadgeLabel}
                    helper={sourceHelperText}
                    sourceReady={currentWorkflow.validation.sourceReady}
                    singleDropNotice={singleDropNotice}
                    sequenceToVideo={sequenceToVideo.job}
                    setSequenceToVideo={sequenceToVideo.setJob}
                    sequencePreview={sequenceToVideo.preview}
                    sequenceVideoPreview={sequenceToVideo.motionPreview.preview}
                    sequenceVideoPreviewLoading={sequenceToVideo.motionPreview.loading}
                    sequenceVideoPreviewError={sequenceToVideo.motionPreview.error}
                    canGenerateSequencePreview={canGenerateSequencePreview}
                    videoToSequence={videoToSequence.job}
                    setVideoToSequence={videoToSequence.setJob}
                    videoPreview={videoToSequence.preview}
                    imageUpscale={imageUpscale.job}
                    setImageUpscale={imageUpscale.setJob}
                    imageUpscalePreview={imageUpscale.preview}
                    videoUpscale={videoUpscale.job}
                    setVideoUpscale={videoUpscale.setJob}
                    videoUpscalePreview={videoUpscale.preview}
                    batchVideoToSequence={batchVideoToSequence.job}
                    setBatchVideoToSequence={batchVideoToSequence.setJob}
                    batchImageUpscale={batchImageUpscale.job}
                    setBatchImageUpscale={batchImageUpscale.setJob}
                    batchVideoUpscale={batchVideoUpscale.job}
                    setBatchVideoUpscale={batchVideoUpscale.setJob}
                    batchSequenceToVideo={batchSequenceToVideo.job}
                    setBatchSequenceToVideo={batchSequenceToVideo.setJob}
                    actions={{
                      pickSequenceFolder: sequenceToVideo.pickSequenceFolder,
                      pickSequenceImages: sequenceToVideo.pickSequenceImages,
                      pickSingleVideo: videoToSequence.pickSingleVideo,
                      pickImageUpscaleImages: imageUpscale.pickImages,
                      pickVideoUpscaleVideo: videoUpscale.pickVideo,
                      pickBatchVideoFiles: batchVideoToSequence.pickVideoFiles,
                      pickBatchVideoScanRoot: batchVideoToSequence.pickScanRoot,
                      pickBatchImageFiles: batchImageUpscale.pickImageFiles,
                      pickBatchImageScanRoot: batchImageUpscale.pickScanRoot,
                      pickBatchVideoUpscaleFiles: batchVideoUpscale.pickVideoFiles,
                      pickBatchVideoUpscaleScanRoot: batchVideoUpscale.pickScanRoot,
                      pickBatchSequenceFolders: batchSequenceToVideo.pickSequenceFolders,
                      pickBatchSequenceScanRoot: batchSequenceToVideo.pickScanRoot,
                      generateSequencePreview,
                      handleSequenceSourceDrop: sequenceToVideo.handleSourceDrop,
                      handleVideoSourceDrop: videoToSequence.handleSourceDrop,
                      handleImageUpscaleDrop: imageUpscale.handleSourceDrop,
                      handleVideoUpscaleDrop: videoUpscale.handleSourceDrop,
                    }}
                  />
                </div>
              </Panel>
            </div>
          </main>

          <aside className="relative z-20 min-h-0 overflow-hidden border-l border-white/8 bg-[#141418]">
            <div className="flex h-full min-h-0 flex-col px-4 py-3">
              <section className="relative flex h-full min-h-0 flex-col overflow-visible">
                <div className="space-y-1 border-b border-white/8 pb-3">
                  <h2 className="text-sm font-semibold text-white">Parameters</h2>
                  <p className="text-sm text-slate-400">{currentWorkflow.meta.strap}</p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto py-3 pr-1">
                  <div className="space-y-3">
                    <WorkflowParameterFields
                      activeTab={activeTab}
                      sequenceToVideo={sequenceToVideo.job}
                      setSequenceToVideo={sequenceToVideo.setJob}
                      videoToSequence={videoToSequence.job}
                      setVideoToSequence={videoToSequence.setJob}
                      imageUpscale={imageUpscale.job}
                      setImageUpscale={imageUpscale.setJob}
                      videoUpscale={videoUpscale.job}
                      setVideoUpscale={videoUpscale.setJob}
                      onVideoToSequenceFpsInput={() => videoToSequence.setFpsTouched(true)}
                      batchVideoToSequence={batchVideoToSequence.job}
                      setBatchVideoToSequence={batchVideoToSequence.setJob}
                      batchImageUpscale={batchImageUpscale.job}
                      setBatchImageUpscale={batchImageUpscale.setJob}
                      batchVideoUpscale={batchVideoUpscale.job}
                      setBatchVideoUpscale={batchVideoUpscale.setJob}
                      batchSequenceToVideo={batchSequenceToVideo.job}
                      setBatchSequenceToVideo={batchSequenceToVideo.setJob}
                      upscalerOptions={supportedUpscalerOptions}
                      sequencePreview={sequenceToVideo.preview}
                      imageUpscalePreview={imageUpscale.preview}
                      videoPreview={videoToSequence.preview}
                      videoUpscalePreview={videoUpscale.preview}
                      sequenceSizeEstimate={sequenceSizeEstimate}
                      actions={{
                        pickOutputVideo: sequenceToVideo.pickOutputVideo,
                        pickSingleOutputFolder: videoToSequence.pickOutputFolder,
                        pickImageUpscaleOutputFolder: imageUpscale.pickOutputFolder,
                        pickVideoUpscaleOutput: videoUpscale.pickOutputVideo,
                        pickBatchOutputRoot,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/8 pt-3">
                  {activity.running ? (
                    <button
                      type="button"
                      onClick={cancelCurrentJob}
                      disabled={!activity.jobId || activity.cancelRequested}
                      className="secondary-button w-full rounded-[8px] px-4 py-3 text-sm font-semibold"
                    >
                      {activity.cancelRequested ? 'Cancelling...' : 'Cancel'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={runCurrentJob}
                      disabled={!currentWorkflow.validation.ready}
                      className="primary-button w-full rounded-[8px] px-4 py-3 text-sm font-semibold"
                    >
                      {currentWorkflow.meta.runLabel}
                    </button>
                  )}
                  <p
                    className={`text-sm ${
                      primaryActionHintTone === 'warning'
                        ? 'text-amber-300'
                        : primaryActionHintTone === 'error'
                          ? 'text-rose-300'
                          : primaryActionHintTone === 'success'
                            ? 'text-emerald-300'
                            : 'text-slate-400'
                    }`}
                  >
                    {primaryActionHint}
                  </p>
                </div>
              </section>
            </div>
          </aside>
        </div>

        <footer className="border-t border-white/8 bg-[#141418]">
          <div className="flex h-[42px] items-center gap-3 px-4 text-[12px] text-slate-300">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${footerStatus.dotClass}`} />
              <span className="shrink-0 font-semibold text-slate-100">{footerStatus.label}</span>
              <span className="text-slate-500">·</span>
              <span className="min-w-0 truncate">{activity.currentItem || activity.message}</span>
            </div>

            {(activity.overallTotal ?? 0) > 0 && (
              <>
                <span className="text-slate-500">·</span>
                <span>
                  {activity.overallIndex ?? 0}/{activity.overallTotal ?? 0}
                </span>
              </>
            )}

            <span className="text-slate-500">·</span>
            <span>Outputs {activity.summary?.completed ?? 0}</span>
            <span className="text-slate-500">·</span>
            <span>Failures {activity.summary?.failed ?? 0}</span>
            <span className="text-slate-500">·</span>
            <span>{Math.round(activity.percent)}%</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
}
