import { startTransition, useEffect, useEffectEvent, useState } from 'react';
import { RATE_LIMITS } from '../../shared/formats';
import { resolveResolution } from '../../shared/resolution';
import type {
  BatchSequenceToVideoJob,
  BatchVideoToSequenceJob,
  JobEvent,
  SequenceToVideoJob,
  VideoToSequenceJob,
} from '../../shared/jobs';
import { type DropNotice } from './components/fields';
import { CompactSegmentGroup, Panel, ProgressSteps } from './components/shell';
import {
  useSequenceMotionPreview,
  useSequenceSourcePreview,
  useVideoSourcePreview,
} from './hooks/use-media-previews';
import {
  buildSuggestedVideoName,
  estimateVideoSizeNote,
  extractDroppedPayload,
  getParentDirectory,
  isImagePath,
  isVideoPath,
  replacePathExtension,
  sortNaturalPaths,
} from './lib/media';
import {
  initialBatchSequenceToVideo,
  initialBatchVideoToSequence,
  initialSequenceToVideo,
  initialVideoToSequence,
  modeMeta,
} from './features/workflows/defaults';
import {
  buildWorkflowSteps,
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
  const [activeMode, setActiveMode] = useState<WorkflowCategory>('Single');
  const [activeSingleTab, setActiveSingleTab] = useState<SingleTabId>('sequence-to-video');
  const [activeBatchTab, setActiveBatchTab] = useState<BatchTabId>('batch-video-to-sequence');
  const [sequenceToVideo, setSequenceToVideo] =
    useState<SequenceToVideoJob>(initialSequenceToVideo);
  const [videoToSequence, setVideoToSequence] =
    useState<VideoToSequenceJob>(initialVideoToSequence);
  const [batchVideoToSequence, setBatchVideoToSequence] = useState<BatchVideoToSequenceJob>(
    initialBatchVideoToSequence
  );
  const [batchSequenceToVideo, setBatchSequenceToVideo] = useState<BatchSequenceToVideoJob>(
    initialBatchSequenceToVideo
  );
  const [singleDropNotice, setSingleDropNotice] = useState<DropNotice | null>(null);
  const [videoToSequenceFpsTouched, setVideoToSequenceFpsTouched] = useState(false);
  const [activity, setActivity] = useState<ActivityState>({
    running: false,
    percent: 0,
    message: 'Choose a workflow, load a source, then run the job.',
    logs: [],
  });
  const [sequencePreviewRequestKey, setSequencePreviewRequestKey] = useState(0);

  const activeTab: TabId = activeMode === 'Single' ? activeSingleTab : activeBatchTab;
  const currentWorkflow = buildWorkflowViewModel(activeTab, {
    sequenceToVideo,
    videoToSequence,
    batchVideoToSequence,
    batchSequenceToVideo,
  });
  const sequencePreview = useSequenceSourcePreview(sequenceToVideo);
  const {
    preview: sequenceVideoPreview,
    loading: sequenceVideoPreviewLoading,
    error: sequenceVideoPreviewError,
  } = useSequenceMotionPreview({
    enabled: activeTab === 'sequence-to-video',
    requestKey: sequencePreviewRequestKey,
    sourceMode: sequenceToVideo.sourceMode,
    sequenceFolder: sequenceToVideo.sequenceFolder,
    imagePaths: sequenceToVideo.imagePaths,
    fps: sequenceToVideo.fps,
    speed: sequenceToVideo.speed,
    resolutionMode: sequenceToVideo.resolutionMode,
    customWidth: sequenceToVideo.customWidth,
    customHeight: sequenceToVideo.customHeight,
  });
  const videoPreview = useVideoSourcePreview(videoToSequence.videoPath);
  const pipelineOptions =
    activeMode === 'Single'
      ? [
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
            label: 'Videos to sequences',
            active: activeBatchTab === 'batch-video-to-sequence',
            onClick: () => setActiveBatchTab('batch-video-to-sequence'),
          },
          {
            label: 'Sequences to videos',
            active: activeBatchTab === 'batch-sequence-to-video',
            onClick: () => setActiveBatchTab('batch-sequence-to-video'),
          },
        ];

  const handleJobEvent = useEffectEvent((event: JobEvent) => {
    startTransition(() => {
      setActivity((current) => {
        switch (event.kind) {
          case 'started':
            return {
              running: true,
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

  useEffect(() => {
    setSingleDropNotice(null);
  }, [activeTab]);

  useEffect(() => {
    setVideoToSequenceFpsTouched(false);
  }, [videoToSequence.videoPath]);

  useEffect(() => {
    if (!videoPreview?.videoPath || !videoPreview.frameRate || videoToSequenceFpsTouched) {
      return;
    }

    const detectedFps = clampDetectedFps(videoPreview.frameRate);
    setVideoToSequence((current) =>
      current.videoPath === videoPreview.videoPath && current.fps !== detectedFps
        ? {
            ...current,
            fps: detectedFps,
          }
        : current
    );
  }, [videoPreview, videoToSequenceFpsTouched]);

  const canGenerateSequencePreview =
    currentWorkflow.validation.sourceReady &&
    currentWorkflow.validation.parametersReady &&
    activeTab === 'sequence-to-video';

  async function pickSequenceFolder(): Promise<void> {
    const folder = await window.mediaApi.pickFolder();
    if (!folder) {
      return;
    }

    setSingleDropNotice(null);
    setSequenceToVideo((current) => ({
      ...current,
      sourceMode: 'folder',
      sequenceFolder: folder,
      imagePaths: [],
    }));
  }

  async function pickSequenceImages(): Promise<void> {
    const imagePaths = await window.mediaApi.pickImageFiles();
    if (imagePaths.length === 0) {
      return;
    }

    setSingleDropNotice(null);
    setSequenceToVideo((current) => ({
      ...current,
      sourceMode: 'images',
      imagePaths,
      sequenceFolder: '',
    }));
  }

  async function pickSingleVideo(): Promise<void> {
    const videoPaths = await window.mediaApi.pickVideoFiles();
    if (videoPaths.length === 0) {
      return;
    }

    setSingleDropNotice(null);
    setVideoToSequence((current) => ({
      ...current,
      videoPath: videoPaths[0],
    }));
  }

  async function pickOutputVideo(): Promise<void> {
    const defaultName = sequenceToVideo.outputPath?.trim()
      ? replacePathExtension(sequenceToVideo.outputPath, sequenceToVideo.format)
      : buildSuggestedVideoName(
          sequenceToVideo.sourceMode === 'folder'
            ? sequenceToVideo.sequenceFolder
            : sequenceToVideo.imagePaths?.[0],
          sequenceToVideo.format
        );
    const filePath = await window.mediaApi.saveVideoFile(defaultName, sequenceToVideo.format);
    if (!filePath) {
      return;
    }

    setSequenceToVideo((current) => ({
      ...current,
      outputPath: filePath,
    }));
  }

  async function pickSingleOutputFolder(): Promise<void> {
    const folder = await window.mediaApi.pickFolder();
    if (!folder) {
      return;
    }

    setVideoToSequence((current) => ({
      ...current,
      outputDir: folder,
    }));
  }

  async function pickBatchVideoFiles(): Promise<void> {
    const videoPaths = await window.mediaApi.pickVideoFiles();
    if (videoPaths.length === 0) {
      return;
    }

    setBatchVideoToSequence((current) => ({
      ...current,
      sourceMode: 'files',
      videoPaths,
      scanRoot: '',
    }));
  }

  async function pickBatchVideoScanRoot(): Promise<void> {
    const folder = await window.mediaApi.pickFolder();
    if (!folder) {
      return;
    }

    setBatchVideoToSequence((current) => ({
      ...current,
      sourceMode: 'scan-root',
      scanRoot: folder,
    }));
  }

  async function pickBatchSequenceFolders(): Promise<void> {
    const sequenceFolders = await window.mediaApi.pickSequenceFolders();
    if (sequenceFolders.length === 0) {
      return;
    }

    setBatchSequenceToVideo((current) => ({
      ...current,
      sourceMode: 'folders',
      sequenceFolders,
      scanRoot: '',
    }));
  }

  async function pickBatchSequenceScanRoot(): Promise<void> {
    const folder = await window.mediaApi.pickFolder();
    if (!folder) {
      return;
    }

    setBatchSequenceToVideo((current) => ({
      ...current,
      sourceMode: 'scan-root',
      scanRoot: folder,
    }));
  }

  async function pickBatchOutputRoot(kind: 'videos' | 'sequences'): Promise<void> {
    const folder = await window.mediaApi.pickFolder();
    if (!folder) {
      return;
    }

    if (kind === 'videos') {
      setBatchVideoToSequence((current) => ({
        ...current,
        outputRoot: folder,
      }));
      return;
    }

    setBatchSequenceToVideo((current) => ({
      ...current,
      outputRoot: folder,
    }));
  }

  async function handleSequenceSourceDrop(dataTransfer: DataTransfer): Promise<void> {
    const dropped = await extractDroppedPayload(dataTransfer);
    const imagePaths = dropped.paths.filter(isImagePath);

    if (imagePaths.length === 0) {
      setSingleDropNotice({
        tone: 'error',
        text: 'Drop one sequence folder or one or more supported image files.',
      });
      return;
    }

    const sortedPaths = sortNaturalPaths(imagePaths);
    const uniqueParents = [...new Set(sortedPaths.map(getParentDirectory))];

    if (dropped.containsDirectory && uniqueParents.length === 1) {
      setSingleDropNotice(null);
      setSequenceToVideo((current) => ({
        ...current,
        sourceMode: 'folder',
        sequenceFolder: uniqueParents[0],
        imagePaths: [],
      }));
      return;
    }

    setSingleDropNotice(null);
    setSequenceToVideo((current) => ({
      ...current,
      sourceMode: 'images',
      imagePaths: sortedPaths,
      sequenceFolder: '',
    }));
  }

  async function handleVideoSourceDrop(dataTransfer: DataTransfer): Promise<void> {
    const dropped = await extractDroppedPayload(dataTransfer);
    const videoPaths = sortNaturalPaths(dropped.paths.filter(isVideoPath));

    if (dropped.containsDirectory) {
      setSingleDropNotice({
        tone: 'error',
        text: 'Drop one video file here, not a folder.',
      });
      return;
    }

    if (videoPaths.length !== 1) {
      setSingleDropNotice({
        tone: 'error',
        text: 'Drop exactly one supported video file.',
      });
      return;
    }

    setSingleDropNotice(null);
    setVideoToSequence((current) => ({
      ...current,
      videoPath: videoPaths[0],
    }));
  }

  async function runCurrentJob(): Promise<void> {
    if (activity.running || !currentWorkflow.validation.ready) {
      return;
    }

    setActivity((current) => ({
      ...current,
      running: true,
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
        success: false,
        message,
        logs: [...current.logs, `[error] ${message}`],
      }));
    }
  }

  const topHelperText = getTopHelperText(activeTab, currentWorkflow.validation, activity);
  const topHelperTone = getTopHelperTone(currentWorkflow.validation, activity);
  const progressSteps = buildWorkflowSteps(currentWorkflow.validation, activity);
  const primaryActionHint = getPrimaryActionHint(currentWorkflow, activity);
  const primaryActionHintTone = getPrimaryActionHintTone(currentWorkflow.validation, activity);
  const sequenceSizeEstimate =
    activeTab === 'sequence-to-video'
      ? estimateVideoSizeNote(
          sequencePreview,
          sequenceToVideo.fps,
          sequenceToVideo.speed,
          sequenceToVideo.format,
          sequenceToVideo.quality,
          resolveResolution(sequenceToVideo, sequencePreview ?? {}, { enforceEven: true })
        )
      : null;
  const sourceBadgeLabel = getSourceBadgeLabel(activeTab, {
    sequenceToVideo,
    videoToSequence,
    batchVideoToSequence,
    batchSequenceToVideo,
    sequencePreview,
    videoPreview,
  });
  const sourceHelperText = getSourceHelperText(activeTab, currentWorkflow.validation);
  const displayTopHelperText = topHelperText === sourceHelperText ? '' : topHelperText;
  const footerStatus = getFooterStatus(activity);

  function generateSequencePreview(): void {
    if (!canGenerateSequencePreview || sequenceVideoPreviewLoading) {
      return;
    }

    setSequencePreviewRequestKey((current) => current + 1);
  }

  return (
    <div className="min-h-screen bg-[#1a1a1f] text-slate-100">
      <div className="grid min-h-screen grid-rows-[minmax(0,1fr)_42px]">
        <div className="grid min-h-0 xl:grid-cols-[minmax(0,1fr)_392px]">
          <main className="min-h-0 overflow-y-auto">
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

                  <ProgressSteps steps={progressSteps} />

                  <WorkflowSourceSection
                    activeTab={activeTab}
                    badge={sourceBadgeLabel}
                    helper={sourceHelperText}
                    sourceReady={currentWorkflow.validation.sourceReady}
                    singleDropNotice={singleDropNotice}
                    sequenceToVideo={sequenceToVideo}
                    setSequenceToVideo={setSequenceToVideo}
                    sequencePreview={sequencePreview}
                    sequenceVideoPreview={sequenceVideoPreview}
                    sequenceVideoPreviewLoading={sequenceVideoPreviewLoading}
                    sequenceVideoPreviewError={sequenceVideoPreviewError}
                    canGenerateSequencePreview={canGenerateSequencePreview}
                    videoToSequence={videoToSequence}
                    setVideoToSequence={setVideoToSequence}
                    videoPreview={videoPreview}
                    batchVideoToSequence={batchVideoToSequence}
                    setBatchVideoToSequence={setBatchVideoToSequence}
                    batchSequenceToVideo={batchSequenceToVideo}
                    setBatchSequenceToVideo={setBatchSequenceToVideo}
                    actions={{
                      pickSequenceFolder,
                      pickSequenceImages,
                      pickSingleVideo,
                      pickBatchVideoFiles,
                      pickBatchVideoScanRoot,
                      pickBatchSequenceFolders,
                      pickBatchSequenceScanRoot,
                      generateSequencePreview,
                      handleSequenceSourceDrop,
                      handleVideoSourceDrop,
                    }}
                  />
                </div>
              </Panel>
            </div>
          </main>

          <aside className="min-h-0 overflow-y-auto border-t border-white/8 bg-[#141418] xl:border-l xl:border-t-0">
            <div className="p-3">
              <section className="app-surface space-y-4 p-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-white">Parameters</h2>
                  <p className="text-sm text-slate-400">{currentWorkflow.meta.strap}</p>
                </div>

                <div className="space-y-3">
                  <WorkflowParameterFields
                    activeTab={activeTab}
                    sequenceToVideo={sequenceToVideo}
                    setSequenceToVideo={setSequenceToVideo}
                    videoToSequence={videoToSequence}
                    setVideoToSequence={setVideoToSequence}
                    onVideoToSequenceFpsInput={() => setVideoToSequenceFpsTouched(true)}
                    batchVideoToSequence={batchVideoToSequence}
                    setBatchVideoToSequence={setBatchVideoToSequence}
                    batchSequenceToVideo={batchSequenceToVideo}
                    setBatchSequenceToVideo={setBatchSequenceToVideo}
                    sequencePreview={sequencePreview}
                    videoPreview={videoPreview}
                    sequenceSizeEstimate={sequenceSizeEstimate}
                    actions={{
                      pickOutputVideo,
                      pickSingleOutputFolder,
                      pickBatchOutputRoot,
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={runCurrentJob}
                    disabled={activity.running || !currentWorkflow.validation.ready}
                    className="primary-button w-full rounded-[8px] px-4 py-3 text-sm font-semibold"
                  >
                    {activity.running ? 'Processing...' : currentWorkflow.meta.runLabel}
                  </button>
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

function clampDetectedFps(value: number): number {
  const rounded = Math.round(value * 1000) / 1000;
  return Math.min(RATE_LIMITS.fps.max, Math.max(RATE_LIMITS.fps.min, rounded));
}
