import type { Dispatch, SetStateAction } from 'react';
import type { SelectOption, UpscalerType } from '../../../../shared/upscalers/registry';
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
import { replacePathExtension } from '../../lib/path-utils';
import { getResolutionControlUi } from '../../lib/resolution-ui';
import { ImageAdjustmentField, ImageFormatField, VideoFormatField, VideoQualityField } from './sections/format-fields';
import { BatchOutputField, FileOutputField } from './sections/output-fields';
import { ResolutionField } from './sections/resolution-fields';
import { FpsField, OverrideFpsModeField, PrefixField, SpeedField, StartNumberField } from './sections/timing-fields';
import { UpscaleFields } from './sections/upscale-fields';
import type { TabId } from './types';

type ParameterActions = {
  pickOutputVideo: () => void | Promise<void>;
  pickSingleOutputFolder: () => void | Promise<void>;
  pickImageUpscaleOutputFolder: () => void | Promise<void>;
  pickVideoUpscaleOutput: () => void | Promise<void>;
  pickBatchOutputRoot: (
    kind:
      | 'batch-video-to-sequence'
      | 'batch-sequence-to-video'
      | 'batch-image-upscale'
      | 'batch-video-upscale'
  ) => void | Promise<void>;
};

export function WorkflowParameterFields(props: {
  activeTab: TabId;
  sequenceToVideo: SequenceToVideoJob;
  setSequenceToVideo: Dispatch<SetStateAction<SequenceToVideoJob>>;
  videoToSequence: VideoToSequenceJob;
  setVideoToSequence: Dispatch<SetStateAction<VideoToSequenceJob>>;
  imageUpscale: ImageUpscaleJob;
  setImageUpscale: Dispatch<SetStateAction<ImageUpscaleJob>>;
  videoUpscale: VideoUpscaleJob;
  setVideoUpscale: Dispatch<SetStateAction<VideoUpscaleJob>>;
  onVideoToSequenceFpsInput: () => void;
  batchVideoToSequence: BatchVideoToSequenceJob;
  setBatchVideoToSequence: Dispatch<SetStateAction<BatchVideoToSequenceJob>>;
  batchImageUpscale: BatchImageUpscaleJob;
  setBatchImageUpscale: Dispatch<SetStateAction<BatchImageUpscaleJob>>;
  batchVideoUpscale: BatchVideoUpscaleJob;
  setBatchVideoUpscale: Dispatch<SetStateAction<BatchVideoUpscaleJob>>;
  batchSequenceToVideo: BatchSequenceToVideoJob;
  setBatchSequenceToVideo: Dispatch<SetStateAction<BatchSequenceToVideoJob>>;
  upscalerOptions: ReadonlyArray<SelectOption<UpscalerType>>;
  sequencePreview: SequenceSourcePreview | null;
  imageUpscalePreview: SequenceSourcePreview | null;
  videoPreview: VideoSourcePreview | null;
  videoUpscalePreview: VideoSourcePreview | null;
  sequenceSizeEstimate: string | null;
  actions: ParameterActions;
}) {
  const sequenceResolutionUi = getResolutionControlUi(
    props.sequenceToVideo,
    props.sequencePreview,
    'video'
  );
  const videoResolutionUi = getResolutionControlUi(
    props.videoToSequence,
    props.videoPreview,
    'images'
  );
  const imageUpscaleResolutionUi = getResolutionControlUi(
    props.imageUpscale,
    props.imageUpscalePreview,
    'images'
  );
  const videoUpscaleResolutionUi = getResolutionControlUi(
    props.videoUpscale,
    props.videoUpscalePreview,
    'video'
  );
  const batchVideoResolutionUi = getResolutionControlUi(
    props.batchVideoToSequence,
    null,
    'images',
    'batch'
  );
  const batchImageUpscaleResolutionUi = getResolutionControlUi(
    props.batchImageUpscale,
    null,
    'images',
    'batch'
  );
  const batchVideoUpscaleResolutionUi = getResolutionControlUi(
    props.batchVideoUpscale,
    null,
    'video',
    'batch'
  );
  const batchSequenceResolutionUi = getResolutionControlUi(
    props.batchSequenceToVideo,
    null,
    'video',
    'batch'
  );

  switch (props.activeTab) {
    case 'sequence-to-video':
      return (
        <>
          <FpsField
            value={props.sequenceToVideo.fps}
            onChange={(value) =>
              props.setSequenceToVideo((current) => ({
                ...current,
                fps: value,
              }))
            }
          />
          <SpeedField
            value={props.sequenceToVideo.speed}
            onChange={(value) =>
              props.setSequenceToVideo((current) => ({
                ...current,
                speed: value,
              }))
            }
          />
          <VideoQualityField
            format={props.sequenceToVideo.format}
            quality={props.sequenceToVideo.quality}
            onChange={(value) =>
              props.setSequenceToVideo((current) => ({
                ...current,
                quality: value,
              }))
            }
          />
          <ResolutionField
            settings={props.sequenceToVideo}
            setSettings={props.setSequenceToVideo}
            ui={sequenceResolutionUi}
            source={props.sequencePreview}
            lockAspect
          />
          <UpscaleFields
            job={props.sequenceToVideo}
            setJob={props.setSequenceToVideo}
            upscalerOptions={props.upscalerOptions}
            hasAlpha={props.sequencePreview?.hasAlpha}
          />
          <VideoFormatField
            value={props.sequenceToVideo.format}
            note={props.sequenceSizeEstimate ?? undefined}
            onChange={(value) =>
              props.setSequenceToVideo((current) => ({
                ...current,
                format: value,
                outputPath: current.outputPath
                  ? replacePathExtension(current.outputPath, value)
                  : current.outputPath,
              }))
            }
          />
          <FileOutputField
            value={props.sequenceToVideo.outputPath}
            emptyText="Automatic"
            detailText="Exports next to the source."
            pickLabel="Choose file"
            onPick={props.actions.pickOutputVideo}
            onClear={() =>
              props.setSequenceToVideo((current) => ({
                ...current,
                outputPath: '',
              }))
            }
          />
        </>
      );

    case 'video-to-sequence':
      return (
        <>
          <FpsField
            value={props.videoToSequence.fps}
            onInput={props.onVideoToSequenceFpsInput}
            onChange={(value) =>
              props.setVideoToSequence((current) => ({
                ...current,
                fps: value,
              }))
            }
          />
          <SpeedField
            value={props.videoToSequence.speed}
            onChange={(value) =>
              props.setVideoToSequence((current) => ({
                ...current,
                speed: value,
              }))
            }
          />
          <ImageFormatField
            value={props.videoToSequence.format}
            onChange={(value) =>
              props.setVideoToSequence((current) => ({
                ...current,
                format: value,
              }))
            }
          />
          <ResolutionField
            settings={props.videoToSequence}
            setSettings={props.setVideoToSequence}
            ui={videoResolutionUi}
            source={props.videoPreview}
            lockAspect
          />
          <UpscaleFields
            job={props.videoToSequence}
            setJob={props.setVideoToSequence}
            upscalerOptions={props.upscalerOptions}
            hasAlpha={props.videoPreview?.hasAlpha}
          />
          <ImageAdjustmentField
            format={props.videoToSequence.format}
            quality={props.videoToSequence.quality}
            onChange={(value) =>
              props.setVideoToSequence((current) => ({
                ...current,
                quality: value,
              }))
            }
          />
          <PrefixField
            value={props.videoToSequence.prefix}
            onChange={(value) =>
              props.setVideoToSequence((current) => ({
                ...current,
                prefix: value,
              }))
            }
          />
          <StartNumberField
            value={props.videoToSequence.startNumber}
            onChange={(value) =>
              props.setVideoToSequence((current) => ({
                ...current,
                startNumber: value,
              }))
            }
          />
          <FileOutputField
            value={props.videoToSequence.outputDir}
            emptyText="Automatic"
            detailText="Exports next to the source."
            pickLabel="Choose folder"
            onPick={props.actions.pickSingleOutputFolder}
            onClear={() =>
              props.setVideoToSequence((current) => ({
                ...current,
                outputDir: '',
              }))
            }
          />
        </>
      );

    case 'image-upscale':
      return (
        <>
          <ImageAdjustmentField
            format={props.imageUpscale.format}
            quality={props.imageUpscale.quality}
            onChange={(value) =>
              props.setImageUpscale((current) => ({
                ...current,
                quality: value,
              }))
            }
          />
          <ResolutionField
            settings={props.imageUpscale}
            setSettings={props.setImageUpscale}
            ui={imageUpscaleResolutionUi}
            source={props.imageUpscalePreview}
            lockAspect
          />
          <UpscaleFields
            job={props.imageUpscale}
            setJob={props.setImageUpscale}
            upscalerOptions={props.upscalerOptions}
            hasAlpha={props.imageUpscalePreview?.hasAlpha}
          />
          <ImageFormatField
            value={props.imageUpscale.format}
            onChange={(value) =>
              props.setImageUpscale((current) => ({
                ...current,
                format: value,
              }))
            }
          />
          <FileOutputField
            value={props.imageUpscale.outputDir}
            emptyText="Automatic"
            detailText="Exports into an upscaled-images folder next to the source."
            pickLabel="Choose folder"
            onPick={props.actions.pickImageUpscaleOutputFolder}
            onClear={() =>
              props.setImageUpscale((current) => ({
                ...current,
                outputDir: '',
              }))
            }
          />
        </>
      );

    case 'video-upscale':
      return (
        <>
          <VideoQualityField
            format={props.videoUpscale.format}
            quality={props.videoUpscale.quality}
            onChange={(value) =>
              props.setVideoUpscale((current) => ({
                ...current,
                quality: value,
              }))
            }
          />
          <ResolutionField
            settings={props.videoUpscale}
            setSettings={props.setVideoUpscale}
            ui={videoUpscaleResolutionUi}
            source={props.videoUpscalePreview}
            lockAspect
          />
          <UpscaleFields
            job={props.videoUpscale}
            setJob={props.setVideoUpscale}
            upscalerOptions={props.upscalerOptions}
            hasAlpha={props.videoUpscalePreview?.hasAlpha}
          />
          <VideoFormatField
            value={props.videoUpscale.format}
            note={props.sequenceSizeEstimate ?? undefined}
            onChange={(value) =>
              props.setVideoUpscale((current) => ({
                ...current,
                format: value,
                outputPath: current.outputPath
                  ? replacePathExtension(current.outputPath, value)
                  : current.outputPath,
              }))
            }
          />
          <FileOutputField
            value={props.videoUpscale.outputPath}
            emptyText="Automatic"
            detailText="Exports next to the source."
            pickLabel="Choose file"
            onPick={props.actions.pickVideoUpscaleOutput}
            onClear={() =>
              props.setVideoUpscale((current) => ({
                ...current,
                outputPath: '',
              }))
            }
          />
        </>
      );

    case 'batch-video-to-sequence':
      return (
        <>
          <OverrideFpsModeField
            job={props.batchVideoToSequence}
            setJob={props.setBatchVideoToSequence}
          />
          {props.batchVideoToSequence.overrideFps && (
            <FpsField
              value={props.batchVideoToSequence.fps}
              onChange={(value) =>
                props.setBatchVideoToSequence((current) => ({
                  ...current,
                  fps: value,
                }))
              }
            />
          )}
          <SpeedField
            value={props.batchVideoToSequence.speed}
            onChange={(value) =>
              props.setBatchVideoToSequence((current) => ({
                ...current,
                speed: value,
              }))
            }
          />
          <ImageFormatField
            value={props.batchVideoToSequence.format}
            onChange={(value) =>
              props.setBatchVideoToSequence((current) => ({
                ...current,
                format: value,
              }))
            }
          />
          <ResolutionField
            settings={props.batchVideoToSequence}
            setSettings={props.setBatchVideoToSequence}
            ui={batchVideoResolutionUi}
            source={null}
            lockAspect={false}
          />
          <UpscaleFields
            job={props.batchVideoToSequence}
            setJob={props.setBatchVideoToSequence}
            upscalerOptions={props.upscalerOptions}
            hasAlpha={undefined}
          />
          <ImageAdjustmentField
            format={props.batchVideoToSequence.format}
            quality={props.batchVideoToSequence.quality}
            onChange={(value) =>
              props.setBatchVideoToSequence((current) => ({
                ...current,
                quality: value,
              }))
            }
          />
          <PrefixField
            value={props.batchVideoToSequence.prefix}
            onChange={(value) =>
              props.setBatchVideoToSequence((current) => ({
                ...current,
                prefix: value,
              }))
            }
          />
          <StartNumberField
            value={props.batchVideoToSequence.startNumber}
            onChange={(value) =>
              props.setBatchVideoToSequence((current) => ({
                ...current,
                startNumber: value,
              }))
            }
          />
          <BatchOutputField
            outputMode={props.batchVideoToSequence.outputMode}
            outputRoot={props.batchVideoToSequence.outputRoot}
            onModeChange={(mode) =>
              props.setBatchVideoToSequence((current) => ({
                ...current,
                outputMode: mode,
              }))
            }
            onPickRoot={() => props.actions.pickBatchOutputRoot('batch-video-to-sequence')}
            onClearRoot={() =>
              props.setBatchVideoToSequence((current) => ({
                ...current,
                outputRoot: '',
              }))
            }
            forEachDetail="Creates one sequence folder next to each source."
            customDetail="Exports all sequences into a chosen folder."
          />
        </>
      );

    case 'batch-image-upscale':
      return (
        <>
          <ImageAdjustmentField
            format={props.batchImageUpscale.format}
            quality={props.batchImageUpscale.quality}
            onChange={(value) =>
              props.setBatchImageUpscale((current) => ({
                ...current,
                quality: value,
              }))
            }
          />
          <ResolutionField
            settings={props.batchImageUpscale}
            setSettings={props.setBatchImageUpscale}
            ui={batchImageUpscaleResolutionUi}
            source={null}
            lockAspect={false}
          />
          <UpscaleFields
            job={props.batchImageUpscale}
            setJob={props.setBatchImageUpscale}
            upscalerOptions={props.upscalerOptions}
            hasAlpha={undefined}
          />
          <ImageFormatField
            value={props.batchImageUpscale.format}
            onChange={(value) =>
              props.setBatchImageUpscale((current) => ({
                ...current,
                format: value,
              }))
            }
          />
          <BatchOutputField
            outputMode={props.batchImageUpscale.outputMode}
            outputRoot={props.batchImageUpscale.outputRoot}
            onModeChange={(mode) =>
              props.setBatchImageUpscale((current) => ({
                ...current,
                outputMode: mode,
              }))
            }
            onPickRoot={() => props.actions.pickBatchOutputRoot('batch-image-upscale')}
            onClearRoot={() =>
              props.setBatchImageUpscale((current) => ({
                ...current,
                outputRoot: '',
              }))
            }
            forEachDetail="Exports each image into an upscaled_images folder next to the source."
            customDetail="Exports all upscaled images into a chosen folder."
          />
        </>
      );

    case 'batch-video-upscale':
      return (
        <>
          <VideoQualityField
            format={props.batchVideoUpscale.format}
            quality={props.batchVideoUpscale.quality}
            onChange={(value) =>
              props.setBatchVideoUpscale((current) => ({
                ...current,
                quality: value,
              }))
            }
          />
          <ResolutionField
            settings={props.batchVideoUpscale}
            setSettings={props.setBatchVideoUpscale}
            ui={batchVideoUpscaleResolutionUi}
            source={null}
            lockAspect={false}
          />
          <UpscaleFields
            job={props.batchVideoUpscale}
            setJob={props.setBatchVideoUpscale}
            upscalerOptions={props.upscalerOptions}
            hasAlpha={undefined}
          />
          <VideoFormatField
            value={props.batchVideoUpscale.format}
            onChange={(value) =>
              props.setBatchVideoUpscale((current) => ({
                ...current,
                format: value,
              }))
            }
          />
          <BatchOutputField
            outputMode={props.batchVideoUpscale.outputMode}
            outputRoot={props.batchVideoUpscale.outputRoot}
            onModeChange={(mode) =>
              props.setBatchVideoUpscale((current) => ({
                ...current,
                outputMode: mode,
              }))
            }
            onPickRoot={() => props.actions.pickBatchOutputRoot('batch-video-upscale')}
            onClearRoot={() =>
              props.setBatchVideoUpscale((current) => ({
                ...current,
                outputRoot: '',
              }))
            }
            forEachDetail="Creates one upscaled video next to each source."
            customDetail="Exports all upscaled videos into a chosen folder."
          />
        </>
      );

    case 'batch-sequence-to-video':
      return (
        <>
          <FpsField
            value={props.batchSequenceToVideo.fps}
            onChange={(value) =>
              props.setBatchSequenceToVideo((current) => ({
                ...current,
                fps: value,
              }))
            }
          />
          <SpeedField
            value={props.batchSequenceToVideo.speed}
            onChange={(value) =>
              props.setBatchSequenceToVideo((current) => ({
                ...current,
                speed: value,
              }))
            }
          />
          <VideoFormatField
            value={props.batchSequenceToVideo.format}
            onChange={(value) =>
              props.setBatchSequenceToVideo((current) => ({
                ...current,
                format: value,
              }))
            }
          />
          <ResolutionField
            settings={props.batchSequenceToVideo}
            setSettings={props.setBatchSequenceToVideo}
            ui={batchSequenceResolutionUi}
            source={null}
            lockAspect={false}
          />
          <UpscaleFields
            job={props.batchSequenceToVideo}
            setJob={props.setBatchSequenceToVideo}
            upscalerOptions={props.upscalerOptions}
            hasAlpha={undefined}
          />
          <VideoQualityField
            format={props.batchSequenceToVideo.format}
            quality={props.batchSequenceToVideo.quality}
            onChange={(value) =>
              props.setBatchSequenceToVideo((current) => ({
                ...current,
                quality: value,
              }))
            }
          />
          <BatchOutputField
            outputMode={props.batchSequenceToVideo.outputMode}
            outputRoot={props.batchSequenceToVideo.outputRoot}
            onModeChange={(mode) =>
              props.setBatchSequenceToVideo((current) => ({
                ...current,
                outputMode: mode,
              }))
            }
            onPickRoot={() => props.actions.pickBatchOutputRoot('batch-sequence-to-video')}
            onClearRoot={() =>
              props.setBatchSequenceToVideo((current) => ({
                ...current,
                outputRoot: '',
              }))
            }
            forEachDetail="Creates one video beside each sequence folder."
            customDetail="Exports all videos into a chosen folder."
          />
        </>
      );

    default:
      return null;
  }
}
