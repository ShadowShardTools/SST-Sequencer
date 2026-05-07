import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type {
  BatchImageUpscaleJob,
  BatchSequenceToVideoJob,
  BatchVideoToSequenceJob,
  BatchVideoUpscaleJob,
  ImageUpscaleJob,
  SequenceToVideoJob,
  VideoUpscaleJob,
  VideoToSequenceJob,
} from '../../../../shared/jobs';
import type { SequenceSourcePreview, VideoSourcePreview } from '../../../../shared/previews';
import type { DropNotice } from '../../components/fields';
import {
  BatchImageUpscaleSourceFields,
  BatchSequenceToVideoSourceFields,
  BatchVideoToSequenceSourceFields,
  BatchVideoUpscaleSourceFields,
} from './sections/batch-source-fields';
import {
  ImageUpscaleSourceFields,
  SequenceToVideoSourceFields,
  VideoToSequenceSourceFields,
  VideoUpscaleSourceFields,
} from './sections/single-source-fields';
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
  pickImageUpscaleImages: () => void | Promise<void>;
  pickVideoUpscaleVideo: () => void | Promise<void>;
  pickBatchVideoFiles: () => void | Promise<void>;
  pickBatchVideoScanRoot: () => void | Promise<void>;
  pickBatchImageFiles: () => void | Promise<void>;
  pickBatchImageScanRoot: () => void | Promise<void>;
  pickBatchVideoUpscaleFiles: () => void | Promise<void>;
  pickBatchVideoUpscaleScanRoot: () => void | Promise<void>;
  pickBatchSequenceFolders: () => void | Promise<void>;
  pickBatchSequenceScanRoot: () => void | Promise<void>;
  generateSequencePreview: () => void | Promise<void>;
  handleSequenceSourceDrop: (dataTransfer: DataTransfer) => Promise<void>;
  handleVideoSourceDrop: (dataTransfer: DataTransfer) => Promise<void>;
  handleImageUpscaleDrop: (dataTransfer: DataTransfer) => Promise<void>;
  handleVideoUpscaleDrop: (dataTransfer: DataTransfer) => Promise<void>;
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
    canGenerateSequencePreview: boolean;
    videoToSequence: VideoToSequenceJob;
    setVideoToSequence: Dispatch<SetStateAction<VideoToSequenceJob>>;
    videoPreview: VideoSourcePreview | null;
    imageUpscale: ImageUpscaleJob;
    setImageUpscale: Dispatch<SetStateAction<ImageUpscaleJob>>;
    imageUpscalePreview: SequenceSourcePreview | null;
    videoUpscale: VideoUpscaleJob;
    setVideoUpscale: Dispatch<SetStateAction<VideoUpscaleJob>>;
    videoUpscalePreview: VideoSourcePreview | null;
    batchVideoToSequence: BatchVideoToSequenceJob;
    setBatchVideoToSequence: Dispatch<SetStateAction<BatchVideoToSequenceJob>>;
    batchImageUpscale: BatchImageUpscaleJob;
    setBatchImageUpscale: Dispatch<SetStateAction<BatchImageUpscaleJob>>;
    batchVideoUpscale: BatchVideoUpscaleJob;
    setBatchVideoUpscale: Dispatch<SetStateAction<BatchVideoUpscaleJob>>;
    batchSequenceToVideo: BatchSequenceToVideoJob;
    setBatchSequenceToVideo: Dispatch<SetStateAction<BatchSequenceToVideoJob>>;
    actions: SourceActions;
  }
): ReactNode {
  switch (props.activeTab) {
    case 'sequence-to-video':
      return (
        <SequenceToVideoSourceFields
          badge={props.badge}
          helper={props.helper}
          sourceReady={props.sourceReady}
          singleDropNotice={props.singleDropNotice}
          job={props.sequenceToVideo}
          setJob={props.setSequenceToVideo}
          sequencePreview={props.sequencePreview}
          motionPreview={props.sequenceVideoPreview}
          motionPreviewLoading={props.sequenceVideoPreviewLoading}
          motionPreviewError={props.sequenceVideoPreviewError}
          canGenerateMotionPreview={props.canGenerateSequencePreview}
          pickSequenceFolder={props.actions.pickSequenceFolder}
          pickSequenceImages={props.actions.pickSequenceImages}
          generateSequencePreview={props.actions.generateSequencePreview}
          handleSequenceSourceDrop={props.actions.handleSequenceSourceDrop}
        />
      );
    case 'video-to-sequence':
      return (
        <VideoToSequenceSourceFields
          badge={props.badge}
          helper={props.helper}
          sourceReady={props.sourceReady}
          singleDropNotice={props.singleDropNotice}
          setJob={props.setVideoToSequence}
          preview={props.videoPreview}
          pickSingleVideo={props.actions.pickSingleVideo}
          handleVideoSourceDrop={props.actions.handleVideoSourceDrop}
        />
      );
    case 'image-upscale':
      return (
        <ImageUpscaleSourceFields
          badge={props.badge}
          helper={props.helper}
          sourceReady={props.sourceReady}
          singleDropNotice={props.singleDropNotice}
          job={props.imageUpscale}
          setJob={props.setImageUpscale}
          preview={props.imageUpscalePreview}
          pickImageUpscaleImages={props.actions.pickImageUpscaleImages}
          handleImageUpscaleDrop={props.actions.handleImageUpscaleDrop}
        />
      );
    case 'video-upscale':
      return (
        <VideoUpscaleSourceFields
          badge={props.badge}
          helper={props.helper}
          sourceReady={props.sourceReady}
          singleDropNotice={props.singleDropNotice}
          setJob={props.setVideoUpscale}
          preview={props.videoUpscalePreview}
          pickVideoUpscaleVideo={props.actions.pickVideoUpscaleVideo}
          handleVideoUpscaleDrop={props.actions.handleVideoUpscaleDrop}
        />
      );
    case 'batch-video-to-sequence':
      return (
        <BatchVideoToSequenceSourceFields
          badge={props.badge}
          helper={props.helper}
          sourceReady={props.sourceReady}
          job={props.batchVideoToSequence}
          setJob={props.setBatchVideoToSequence}
          pickBatchVideoFiles={props.actions.pickBatchVideoFiles}
          pickBatchVideoScanRoot={props.actions.pickBatchVideoScanRoot}
        />
      );
    case 'batch-image-upscale':
      return (
        <BatchImageUpscaleSourceFields
          badge={props.badge}
          helper={props.helper}
          sourceReady={props.sourceReady}
          job={props.batchImageUpscale}
          setJob={props.setBatchImageUpscale}
          pickBatchImageFiles={props.actions.pickBatchImageFiles}
          pickBatchImageScanRoot={props.actions.pickBatchImageScanRoot}
        />
      );
    case 'batch-video-upscale':
      return (
        <BatchVideoUpscaleSourceFields
          badge={props.badge}
          helper={props.helper}
          sourceReady={props.sourceReady}
          job={props.batchVideoUpscale}
          setJob={props.setBatchVideoUpscale}
          pickBatchVideoFiles={props.actions.pickBatchVideoUpscaleFiles}
          pickBatchVideoScanRoot={props.actions.pickBatchVideoUpscaleScanRoot}
        />
      );
    case 'batch-sequence-to-video':
      return (
        <BatchSequenceToVideoSourceFields
          badge={props.badge}
          helper={props.helper}
          sourceReady={props.sourceReady}
          job={props.batchSequenceToVideo}
          setJob={props.setBatchSequenceToVideo}
          pickBatchSequenceFolders={props.actions.pickBatchSequenceFolders}
          pickBatchSequenceScanRoot={props.actions.pickBatchSequenceScanRoot}
        />
      );
    default:
      return null;
  }
}
