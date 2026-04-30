import type { Dispatch, SetStateAction } from 'react';
import {
  IMAGE_FORMAT_OPTIONS,
  RATE_LIMITS,
  VIDEO_FORMAT_OPTIONS,
  type ImageFormat,
  type VideoFormat,
} from '../../../../shared/formats';
import type {
  BatchSequenceToVideoJob,
  BatchVideoToSequenceJob,
  SequenceToVideoJob,
  VideoToSequenceJob,
} from '../../../../shared/jobs';
import {
  BatchOutputPicker,
  InspectorFieldRow,
  OutputField,
  SelectField,
  StepperField,
  TextField,
} from '../../components/fields';
import type { TabId } from './types';

type ParameterActions = {
  pickOutputVideo: () => void | Promise<void>;
  pickSingleOutputFolder: () => void | Promise<void>;
  pickBatchOutputRoot: (kind: 'videos' | 'sequences') => void | Promise<void>;
};

export function WorkflowParameterFields(props: {
  activeTab: TabId;
  sequenceToVideo: SequenceToVideoJob;
  setSequenceToVideo: Dispatch<SetStateAction<SequenceToVideoJob>>;
  videoToSequence: VideoToSequenceJob;
  setVideoToSequence: Dispatch<SetStateAction<VideoToSequenceJob>>;
  batchVideoToSequence: BatchVideoToSequenceJob;
  setBatchVideoToSequence: Dispatch<SetStateAction<BatchVideoToSequenceJob>>;
  batchSequenceToVideo: BatchSequenceToVideoJob;
  setBatchSequenceToVideo: Dispatch<SetStateAction<BatchSequenceToVideoJob>>;
  sequenceSizeEstimate: string | null;
  actions: ParameterActions;
}) {
  switch (props.activeTab) {
    case 'sequence-to-video':
      return (
        <>
          <InspectorFieldRow label="FPS">
            <StepperField
              value={props.sequenceToVideo.fps}
              min={RATE_LIMITS.fps.min}
              max={RATE_LIMITS.fps.max}
              step={RATE_LIMITS.fps.step}
              onChange={(value) =>
                props.setSequenceToVideo((current) => ({
                  ...current,
                  fps: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Speed">
            <StepperField
              value={props.sequenceToVideo.speed}
              min={RATE_LIMITS.speed.min}
              max={RATE_LIMITS.speed.max}
              step={RATE_LIMITS.speed.step}
              onChange={(value) =>
                props.setSequenceToVideo((current) => ({
                  ...current,
                  speed: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Format" note={props.sequenceSizeEstimate ?? undefined}>
            <SelectField
              value={props.sequenceToVideo.format}
              options={VIDEO_FORMAT_OPTIONS}
              onChange={(value) =>
                props.setSequenceToVideo((current) => ({
                  ...current,
                  format: value as VideoFormat,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Output path">
            <OutputField
              value={props.sequenceToVideo.outputPath}
              emptyText="Automatic"
              detailText="Exports next to the source."
              pickLabel="Choose file"
              onPick={props.actions.pickOutputVideo}
              clearLabel="Auto"
              onClear={() =>
                props.setSequenceToVideo((current) => ({
                  ...current,
                  outputPath: '',
                }))
              }
            />
          </InspectorFieldRow>
        </>
      );
    case 'video-to-sequence':
      return (
        <>
          <InspectorFieldRow label="FPS">
            <StepperField
              value={props.videoToSequence.fps}
              min={RATE_LIMITS.fps.min}
              max={RATE_LIMITS.fps.max}
              step={RATE_LIMITS.fps.step}
              onChange={(value) =>
                props.setVideoToSequence((current) => ({
                  ...current,
                  fps: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Speed">
            <StepperField
              value={props.videoToSequence.speed}
              min={RATE_LIMITS.speed.min}
              max={RATE_LIMITS.speed.max}
              step={RATE_LIMITS.speed.step}
              onChange={(value) =>
                props.setVideoToSequence((current) => ({
                  ...current,
                  speed: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Format">
            <SelectField
              value={props.videoToSequence.format}
              options={IMAGE_FORMAT_OPTIONS}
              onChange={(value) =>
                props.setVideoToSequence((current) => ({
                  ...current,
                  format: value as ImageFormat,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Prefix">
            <TextField
              value={props.videoToSequence.prefix}
              onChange={(value) =>
                props.setVideoToSequence((current) => ({
                  ...current,
                  prefix: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Start #">
            <StepperField
              value={props.videoToSequence.startNumber}
              min={0}
              max={999999}
              step={1}
              onChange={(value) =>
                props.setVideoToSequence((current) => ({
                  ...current,
                  startNumber: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Output path">
            <OutputField
              value={props.videoToSequence.outputDir}
              emptyText="Automatic"
              detailText="Exports next to the source."
              pickLabel="Choose folder"
              onPick={props.actions.pickSingleOutputFolder}
              clearLabel="Auto"
              onClear={() =>
                props.setVideoToSequence((current) => ({
                  ...current,
                  outputDir: '',
                }))
              }
            />
          </InspectorFieldRow>
        </>
      );
    case 'batch-video-to-sequence':
      return (
        <>
          <InspectorFieldRow label="FPS">
            <StepperField
              value={props.batchVideoToSequence.fps}
              min={RATE_LIMITS.fps.min}
              max={RATE_LIMITS.fps.max}
              step={RATE_LIMITS.fps.step}
              onChange={(value) =>
                props.setBatchVideoToSequence((current) => ({
                  ...current,
                  fps: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Speed">
            <StepperField
              value={props.batchVideoToSequence.speed}
              min={RATE_LIMITS.speed.min}
              max={RATE_LIMITS.speed.max}
              step={RATE_LIMITS.speed.step}
              onChange={(value) =>
                props.setBatchVideoToSequence((current) => ({
                  ...current,
                  speed: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Format">
            <SelectField
              value={props.batchVideoToSequence.format}
              options={IMAGE_FORMAT_OPTIONS}
              onChange={(value) =>
                props.setBatchVideoToSequence((current) => ({
                  ...current,
                  format: value as ImageFormat,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Prefix">
            <TextField
              value={props.batchVideoToSequence.prefix}
              onChange={(value) =>
                props.setBatchVideoToSequence((current) => ({
                  ...current,
                  prefix: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Start #">
            <StepperField
              value={props.batchVideoToSequence.startNumber}
              min={0}
              max={999999}
              step={1}
              onChange={(value) =>
                props.setBatchVideoToSequence((current) => ({
                  ...current,
                  startNumber: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Output path">
            <BatchOutputPicker
              outputMode={props.batchVideoToSequence.outputMode}
              outputRoot={props.batchVideoToSequence.outputRoot}
              onModeChange={(mode) =>
                props.setBatchVideoToSequence((current) => ({
                  ...current,
                  outputMode: mode,
                }))
              }
              onPickRoot={() => props.actions.pickBatchOutputRoot('videos')}
              onClearRoot={() =>
                props.setBatchVideoToSequence((current) => ({
                  ...current,
                  outputRoot: '',
                }))
              }
              forEachDetail="Creates one sequence folder next to each source."
              customDetail="Exports all sequences into a chosen folder."
            />
          </InspectorFieldRow>
        </>
      );
    case 'batch-sequence-to-video':
      return (
        <>
          <InspectorFieldRow label="FPS">
            <StepperField
              value={props.batchSequenceToVideo.fps}
              min={RATE_LIMITS.fps.min}
              max={RATE_LIMITS.fps.max}
              step={RATE_LIMITS.fps.step}
              onChange={(value) =>
                props.setBatchSequenceToVideo((current) => ({
                  ...current,
                  fps: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Speed">
            <StepperField
              value={props.batchSequenceToVideo.speed}
              min={RATE_LIMITS.speed.min}
              max={RATE_LIMITS.speed.max}
              step={RATE_LIMITS.speed.step}
              onChange={(value) =>
                props.setBatchSequenceToVideo((current) => ({
                  ...current,
                  speed: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Format">
            <SelectField
              value={props.batchSequenceToVideo.format}
              options={VIDEO_FORMAT_OPTIONS}
              onChange={(value) =>
                props.setBatchSequenceToVideo((current) => ({
                  ...current,
                  format: value as VideoFormat,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Output path">
            <BatchOutputPicker
              outputMode={props.batchSequenceToVideo.outputMode}
              outputRoot={props.batchSequenceToVideo.outputRoot}
              onModeChange={(mode) =>
                props.setBatchSequenceToVideo((current) => ({
                  ...current,
                  outputMode: mode,
                }))
              }
              onPickRoot={() => props.actions.pickBatchOutputRoot('sequences')}
              onClearRoot={() =>
                props.setBatchSequenceToVideo((current) => ({
                  ...current,
                  outputRoot: '',
                }))
              }
              forEachDetail="Creates one video beside each sequence folder."
              customDetail="Exports all videos into a chosen folder."
            />
          </InspectorFieldRow>
        </>
      );
    default:
      return null;
  }
}
