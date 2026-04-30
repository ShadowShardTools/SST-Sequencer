import type { Dispatch, SetStateAction } from 'react';
import type {
  BatchSequenceToVideoJob,
  BatchVideoToSequenceJob,
  SequenceToVideoJob,
  VideoToSequenceJob,
} from '../../../../shared/jobs';
import type { SequenceSourcePreview, VideoSourcePreview } from '../../../../shared/previews';
import { CompactSegmentGroup, SectionCard } from '../../components/shell';
import {
  DropNoticeBanner,
  type DropNotice,
  PathPicker,
  SingleDropZone,
  ToggleField,
} from '../../components/fields';
import {
  RenderedVideoPreview,
  SequenceMotionPreview,
  SequencePreviewStrip,
  VideoPreviewStrip,
} from '../../components/previews';
import { buildPreviewItems } from '../../lib/media';
import type { TabId } from './types';

type SharedSectionProps = {
  badge: string;
  helper: string;
  sourceReady: boolean;
};

type SourceActions = {
  pickSequenceFolder: () => void | Promise<void>;
  pickSequenceImages: () => void | Promise<void>;
  pickSingleVideo: () => void | Promise<void>;
  pickBatchVideoFiles: () => void | Promise<void>;
  pickBatchVideoScanRoot: () => void | Promise<void>;
  pickBatchSequenceFolders: () => void | Promise<void>;
  pickBatchSequenceScanRoot: () => void | Promise<void>;
  handleSequenceSourceDrop: (dataTransfer: DataTransfer) => Promise<void>;
  handleVideoSourceDrop: (dataTransfer: DataTransfer) => Promise<void>;
};

export function WorkflowSourceSection(
  props: SharedSectionProps & {
    activeTab: TabId;
    singleDropNotice: DropNotice | null;
    sequenceToVideo: SequenceToVideoJob;
    setSequenceToVideo: Dispatch<SetStateAction<SequenceToVideoJob>>;
    sequencePreview: SequenceSourcePreview | null;
    sequenceVideoPreview: VideoSourcePreview | null;
    sequenceVideoPreviewLoading: boolean;
    sequenceVideoPreviewError: string | null;
    renderedVideoPreview: VideoSourcePreview | null;
    videoToSequence: VideoToSequenceJob;
    setVideoToSequence: Dispatch<SetStateAction<VideoToSequenceJob>>;
    videoPreview: VideoSourcePreview | null;
    batchVideoToSequence: BatchVideoToSequenceJob;
    setBatchVideoToSequence: Dispatch<SetStateAction<BatchVideoToSequenceJob>>;
    batchSequenceToVideo: BatchSequenceToVideoJob;
    setBatchSequenceToVideo: Dispatch<SetStateAction<BatchSequenceToVideoJob>>;
    actions: SourceActions;
  }
) {
  const renderedVideoPath = props.renderedVideoPreview?.videoPath;

  switch (props.activeTab) {
    case 'sequence-to-video':
      return (
        <SectionCard
          step="1"
          title="Source"
          badge={props.badge}
          helper={props.helper}
          helperTone={props.sourceReady ? 'muted' : 'warning'}
        >
          <SingleDropZone
            icon="folder"
            title="Drop a sequence folder or image files"
            description="Drag the source in here."
            acceptedLabel="PNG, JPG, EXR, TIFF"
            onDropTransfer={props.actions.handleSequenceSourceDrop}
            browseActions={[
              {
                label: 'Browse folder',
                onClick: props.actions.pickSequenceFolder,
              },
              {
                label: 'Browse images',
                onClick: props.actions.pickSequenceImages,
              },
            ]}
          />

          {props.singleDropNotice && <DropNoticeBanner notice={props.singleDropNotice} />}

          {!props.sequenceVideoPreviewLoading &&
            !props.sequenceVideoPreview &&
            props.sequencePreview && (
              <SequencePreviewStrip
                preview={props.sequencePreview}
                fps={props.sequenceToVideo.fps}
                sourceMode={props.sequenceToVideo.sourceMode}
                sourceLabel={
                  props.sequenceToVideo.sourceMode === 'folder'
                    ? props.sequenceToVideo.sequenceFolder
                    : props.sequenceToVideo.imagePaths?.[0]
                }
                onClear={() =>
                  props.setSequenceToVideo((current) => ({
                    ...current,
                    sourceMode: 'folder',
                    sequenceFolder: '',
                    imagePaths: [],
                  }))
                }
              />
            )}

          {(props.sequenceVideoPreviewLoading ||
            props.sequenceVideoPreview ||
            props.sequenceVideoPreviewError) && (
            <SequenceMotionPreview
              preview={props.sequenceVideoPreview}
              loading={props.sequenceVideoPreviewLoading}
              error={props.sequenceVideoPreviewError}
            />
          )}

          {props.renderedVideoPreview && (
            <RenderedVideoPreview
              preview={props.renderedVideoPreview}
              onReveal={() => {
                if (renderedVideoPath) {
                  void window.mediaApi.revealPath(renderedVideoPath);
                }
              }}
            />
          )}
        </SectionCard>
      );
    case 'video-to-sequence':
      return (
        <SectionCard
          step="1"
          title="Source"
          badge={props.badge}
          helper={props.helper}
          helperTone={props.sourceReady ? 'muted' : 'warning'}
        >
          <SingleDropZone
            icon="video"
            title="Drop one video file"
            description="Drag the source in here."
            acceptedLabel="MP4, MOV, MKV, AVI, WEBM"
            onDropTransfer={props.actions.handleVideoSourceDrop}
            browseActions={[
              {
                label: 'Browse video',
                onClick: props.actions.pickSingleVideo,
              },
            ]}
          />

          {props.singleDropNotice && <DropNoticeBanner notice={props.singleDropNotice} />}

          {props.videoPreview && (
            <VideoPreviewStrip
              preview={props.videoPreview}
              onClear={() =>
                props.setVideoToSequence((current) => ({
                  ...current,
                  videoPath: '',
                }))
              }
            />
          )}
        </SectionCard>
      );
    case 'batch-video-to-sequence':
      return (
        <SectionCard
          step="1"
          title="Source"
          badge={props.badge}
          helper={props.helper}
          helperTone={props.sourceReady ? 'muted' : 'warning'}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CompactSegmentGroup
              label="Input"
              options={[
                {
                  label: 'Selected files',
                  active: props.batchVideoToSequence.sourceMode === 'files',
                  onClick: () =>
                    props.setBatchVideoToSequence((current) => ({
                      ...current,
                      sourceMode: 'files',
                    })),
                },
                {
                  label: 'Scan root folder',
                  active: props.batchVideoToSequence.sourceMode === 'scan-root',
                  onClick: () =>
                    props.setBatchVideoToSequence((current) => ({
                      ...current,
                      sourceMode: 'scan-root',
                    })),
                },
              ]}
            />

            <ToggleField
              label="Recursive scan"
              description="Search subfolders."
              checked={props.batchVideoToSequence.recursive}
              onChange={(checked) =>
                props.setBatchVideoToSequence((current) => ({
                  ...current,
                  recursive: checked,
                }))
              }
            />
          </div>

          <PathPicker
            label="Batch input"
            displayValue={
              props.batchVideoToSequence.sourceMode === 'files'
                ? `${props.batchVideoToSequence.videoPaths?.length ?? 0} video file(s) selected`
                : props.batchVideoToSequence.scanRoot
            }
            emptyText={
              props.batchVideoToSequence.sourceMode === 'files'
                ? 'No video files selected.'
                : 'No scan root selected.'
            }
            previewItems={
              props.batchVideoToSequence.sourceMode === 'files'
                ? buildPreviewItems(props.batchVideoToSequence.videoPaths, 8)
                : undefined
            }
            primaryLabel={
              props.batchVideoToSequence.sourceMode === 'files'
                ? 'Choose videos'
                : 'Choose root folder'
            }
            onPrimary={
              props.batchVideoToSequence.sourceMode === 'files'
                ? props.actions.pickBatchVideoFiles
                : props.actions.pickBatchVideoScanRoot
            }
          />
        </SectionCard>
      );
    case 'batch-sequence-to-video':
      return (
        <SectionCard
          step="1"
          title="Source"
          badge={props.badge}
          helper={props.helper}
          helperTone={props.sourceReady ? 'muted' : 'warning'}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CompactSegmentGroup
              label="Input"
              options={[
                {
                  label: 'Selected folders',
                  active: props.batchSequenceToVideo.sourceMode === 'folders',
                  onClick: () =>
                    props.setBatchSequenceToVideo((current) => ({
                      ...current,
                      sourceMode: 'folders',
                    })),
                },
                {
                  label: 'Scan root folder',
                  active: props.batchSequenceToVideo.sourceMode === 'scan-root',
                  onClick: () =>
                    props.setBatchSequenceToVideo((current) => ({
                      ...current,
                      sourceMode: 'scan-root',
                    })),
                },
              ]}
            />

            <ToggleField
              label="Recursive scan"
              description="Search subfolders."
              checked={props.batchSequenceToVideo.recursive}
              onChange={(checked) =>
                props.setBatchSequenceToVideo((current) => ({
                  ...current,
                  recursive: checked,
                }))
              }
            />
          </div>

          <PathPicker
            label="Batch input"
            displayValue={
              props.batchSequenceToVideo.sourceMode === 'folders'
                ? `${props.batchSequenceToVideo.sequenceFolders?.length ?? 0} folder(s) selected`
                : props.batchSequenceToVideo.scanRoot
            }
            emptyText={
              props.batchSequenceToVideo.sourceMode === 'folders'
                ? 'No sequence folders selected.'
                : 'No scan root selected.'
            }
            previewItems={
              props.batchSequenceToVideo.sourceMode === 'folders'
                ? buildPreviewItems(props.batchSequenceToVideo.sequenceFolders, 8)
                : undefined
            }
            primaryLabel={
              props.batchSequenceToVideo.sourceMode === 'folders'
                ? 'Choose folders'
                : 'Choose root folder'
            }
            onPrimary={
              props.batchSequenceToVideo.sourceMode === 'folders'
                ? props.actions.pickBatchSequenceFolders
                : props.actions.pickBatchSequenceScanRoot
            }
          />
        </SectionCard>
      );
    default:
      return null;
  }
}
