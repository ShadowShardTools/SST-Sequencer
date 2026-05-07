import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type {
  ImageUpscaleJob,
  SequenceToVideoJob,
  VideoUpscaleJob,
  VideoToSequenceJob,
} from '../../../../../shared/jobs';
import type { SequenceSourcePreview, VideoSourcePreview } from '../../../../../shared/previews';
import {
  DropNoticeBanner,
  type DropNotice,
  SingleDropZone,
} from '../../../components/fields';
import {
  SequenceMotionPreview,
  SequencePreviewStrip,
  VideoPreviewStrip,
} from '../../../components/previews';
import { SourceStepCard } from './source-step-card';

type SharedSingleSourceProps = {
  badge: string;
  helper: string;
  sourceReady: boolean;
  singleDropNotice: DropNotice | null;
};

export function SequenceToVideoSourceFields(
  props: SharedSingleSourceProps & {
    job: SequenceToVideoJob;
    setJob: Dispatch<SetStateAction<SequenceToVideoJob>>;
    sequencePreview: SequenceSourcePreview | null;
    motionPreview: VideoSourcePreview | null;
    motionPreviewLoading: boolean;
    motionPreviewError: string | null;
    canGenerateMotionPreview: boolean;
    pickSequenceFolder: () => void | Promise<void>;
    pickSequenceImages: () => void | Promise<void>;
    generateSequencePreview: () => void | Promise<void>;
    handleSequenceSourceDrop: (dataTransfer: DataTransfer) => Promise<void>;
  }
): ReactNode {
  return (
    <SourceStepCard badge={props.badge} helper={props.helper} sourceReady={props.sourceReady}>
      <SingleDropZone
        icon="folder"
        title="Drop a sequence folder or image files"
        description="Drag the source in here."
        acceptedLabel="PNG, JPG, WEBP, BMP, TGA, EXR, TIFF"
        onDropTransfer={props.handleSequenceSourceDrop}
        browseActions={[
          { label: 'Browse folder', onClick: props.pickSequenceFolder },
          { label: 'Browse images', onClick: props.pickSequenceImages },
        ]}
      />

      {props.singleDropNotice && <DropNoticeBanner notice={props.singleDropNotice} />}

      {!props.motionPreview && props.sequencePreview && (
        <SequencePreviewStrip
          preview={props.sequencePreview}
          fps={props.job.fps}
          sourceMode={props.job.sourceMode}
          sourceLabel={
            props.job.sourceMode === 'folder' ? props.job.sequenceFolder : props.job.imagePaths?.[0]
          }
          onClear={() =>
            props.setJob((current) => ({
              ...current,
              sourceMode: 'folder',
              sequenceFolder: '',
              imagePaths: [],
            }))
          }
        />
      )}

      {props.sequencePreview && (
        <SequenceMotionPreview
          preview={props.motionPreview}
          loading={props.motionPreviewLoading}
          error={props.motionPreviewError}
          canGenerate={props.canGenerateMotionPreview}
          onGenerate={props.generateSequencePreview}
          onClear={() =>
            props.setJob((current) => ({
              ...current,
              sourceMode: 'folder',
              sequenceFolder: '',
              imagePaths: [],
            }))
          }
        />
      )}
    </SourceStepCard>
  );
}

export function VideoToSequenceSourceFields(
  props: SharedSingleSourceProps & {
    setJob: Dispatch<SetStateAction<VideoToSequenceJob>>;
    preview: VideoSourcePreview | null;
    pickSingleVideo: () => void | Promise<void>;
    handleVideoSourceDrop: (dataTransfer: DataTransfer) => Promise<void>;
  }
): ReactNode {
  return (
    <SourceStepCard badge={props.badge} helper={props.helper} sourceReady={props.sourceReady}>
      <SingleDropZone
        icon="video"
        title="Drop one video file"
        description="Drag the source in here."
        acceptedLabel="MP4, MOV, MKV, AVI, WEBM, GIF, APNG"
        onDropTransfer={props.handleVideoSourceDrop}
        browseActions={[{ label: 'Browse video', onClick: props.pickSingleVideo }]}
      />

      {props.singleDropNotice && <DropNoticeBanner notice={props.singleDropNotice} />}

      {props.preview && (
        <VideoPreviewStrip
          preview={props.preview}
          onClear={() =>
            props.setJob((current) => ({
              ...current,
              videoPath: '',
            }))
          }
        />
      )}
    </SourceStepCard>
  );
}

export function ImageUpscaleSourceFields(
  props: SharedSingleSourceProps & {
    job: ImageUpscaleJob;
    setJob: Dispatch<SetStateAction<ImageUpscaleJob>>;
    preview: SequenceSourcePreview | null;
    pickImageUpscaleImages: () => void | Promise<void>;
    handleImageUpscaleDrop: (dataTransfer: DataTransfer) => Promise<void>;
  }
): ReactNode {
  return (
    <SourceStepCard badge={props.badge} helper={props.helper} sourceReady={props.sourceReady}>
      <SingleDropZone
        icon="folder"
        title="Drop one or more image files"
        description="Drag the source images in here."
        acceptedLabel="PNG, JPG, WEBP, BMP, TGA, EXR, TIFF"
        onDropTransfer={props.handleImageUpscaleDrop}
        browseActions={[{ label: 'Browse images', onClick: props.pickImageUpscaleImages }]}
      />

      {props.singleDropNotice && <DropNoticeBanner notice={props.singleDropNotice} />}

      {props.preview && (
        <SequencePreviewStrip
          preview={props.preview}
          fps={1}
          sourceMode="images"
          sourceLabel={props.job.imagePaths?.[0]}
          onClear={() =>
            props.setJob((current) => ({
              ...current,
              imagePaths: [],
            }))
          }
        />
      )}
    </SourceStepCard>
  );
}

export function VideoUpscaleSourceFields(
  props: SharedSingleSourceProps & {
    setJob: Dispatch<SetStateAction<VideoUpscaleJob>>;
    preview: VideoSourcePreview | null;
    pickVideoUpscaleVideo: () => void | Promise<void>;
    handleVideoUpscaleDrop: (dataTransfer: DataTransfer) => Promise<void>;
  }
): ReactNode {
  return (
    <SourceStepCard badge={props.badge} helper={props.helper} sourceReady={props.sourceReady}>
      <SingleDropZone
        icon="video"
        title="Drop one video file"
        description="Drag the source in here."
        acceptedLabel="MP4, MOV, MKV, AVI, WEBM, GIF, APNG"
        onDropTransfer={props.handleVideoUpscaleDrop}
        browseActions={[{ label: 'Browse video', onClick: props.pickVideoUpscaleVideo }]}
      />

      {props.singleDropNotice && <DropNoticeBanner notice={props.singleDropNotice} />}

      {props.preview && (
        <VideoPreviewStrip
          preview={props.preview}
          onClear={() =>
            props.setJob((current) => ({
              ...current,
              videoPath: '',
            }))
          }
        />
      )}
    </SourceStepCard>
  );
}
