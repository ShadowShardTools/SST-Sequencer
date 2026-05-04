import type { Dispatch, SetStateAction } from 'react';
import {
  ALPHA_MODE_OPTIONS,
  QUALITY_LIMITS,
  IMAGE_FORMAT_OPTIONS,
  RATE_LIMITS,
  UPSCALE_OPTIONS,
  VIDEO_FORMAT_OPTIONS,
  type ImageFormat,
  type SelectOption,
  type UpscalerType,
  type VideoFormat,
} from '../../../../shared/formats';
import { RESOLUTION_LIMITS } from '../../../../shared/resolution';
import type {
  BatchSequenceToVideoJob,
  BatchVideoToSequenceJob,
  SequenceToVideoJob,
  VideoToSequenceJob,
} from '../../../../shared/jobs';
import type { SequenceSourcePreview, VideoSourcePreview } from '../../../../shared/previews';
import {
  BatchOutputPicker,
  InspectorFieldRow,
  OutputField,
  SelectField,
  SliderField,
  StepperField,
  TextField,
} from '../../components/fields';
import {
  getAspectLockedDimensions,
  getAlphaModeNote,
  getImageAdjustmentUi,
  getResolutionControlUi,
  getUpscaleNote,
  getVideoQualityNote,
  replacePathExtension,
} from '../../lib/media';
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
  onVideoToSequenceFpsInput: () => void;
  batchVideoToSequence: BatchVideoToSequenceJob;
  setBatchVideoToSequence: Dispatch<SetStateAction<BatchVideoToSequenceJob>>;
  batchSequenceToVideo: BatchSequenceToVideoJob;
  setBatchSequenceToVideo: Dispatch<SetStateAction<BatchSequenceToVideoJob>>;
  upscalerOptions: ReadonlyArray<SelectOption<UpscalerType>>;
  sequencePreview: SequenceSourcePreview | null;
  videoPreview: VideoSourcePreview | null;
  sequenceSizeEstimate: string | null;
  actions: ParameterActions;
}) {
  const singleImageAdjustment = getImageAdjustmentUi(
    props.videoToSequence.format,
    props.videoToSequence.quality
  );
  const batchImageAdjustment = getImageAdjustmentUi(
    props.batchVideoToSequence.format,
    props.batchVideoToSequence.quality
  );
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

          <InspectorFieldRow
            label="Quality"
            note={getVideoQualityNote(props.sequenceToVideo.format, props.sequenceToVideo.quality)}
          >
            <SliderField
              value={props.sequenceToVideo.quality}
              min={QUALITY_LIMITS.video.min}
              max={QUALITY_LIMITS.video.max}
              step={QUALITY_LIMITS.video.step}
              valueSuffix="%"
              minLabel="Smaller file"
              maxLabel="Best quality"
              onChange={(value) =>
                props.setSequenceToVideo((current) => ({
                  ...current,
                  quality: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label="Resolution" note={sequenceResolutionUi.note}>
            <div className="space-y-2">
              <SelectField
                value={props.sequenceToVideo.resolutionMode}
                options={sequenceResolutionUi.options}
                onChange={(value) => {
                  props.setSequenceToVideo((current) => {
                    if (value !== 'custom') {
                      return {
                        ...current,
                        resolutionMode: value,
                      };
                    }

                    const baseResolution = sequenceResolutionUi.resolved ??
                      getAspectLockedDimensions(
                        props.sequencePreview,
                        current.customWidth,
                        undefined,
                        'width'
                      ) ?? {
                        width: current.customWidth || 1920,
                        height: current.customHeight || 1080,
                      };

                    return {
                      ...current,
                      resolutionMode: 'custom',
                      customWidth: baseResolution.width,
                      customHeight: baseResolution.height,
                    };
                  });
                }}
              />

              {props.sequenceToVideo.resolutionMode === 'custom' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      Width
                    </div>
                    <StepperField
                      value={props.sequenceToVideo.customWidth ?? 1920}
                      min={RESOLUTION_LIMITS.dimension.min}
                      max={RESOLUTION_LIMITS.dimension.max}
                      step={RESOLUTION_LIMITS.dimension.step}
                      onChange={(value) => {
                        const locked = getAspectLockedDimensions(
                          props.sequencePreview,
                          value,
                          undefined,
                          'width'
                        );

                        props.setSequenceToVideo((current) => ({
                          ...current,
                          customWidth: value,
                          customHeight: locked?.height ?? current.customHeight,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      Height
                    </div>
                    <StepperField
                      value={props.sequenceToVideo.customHeight ?? 1080}
                      min={RESOLUTION_LIMITS.dimension.min}
                      max={RESOLUTION_LIMITS.dimension.max}
                      step={RESOLUTION_LIMITS.dimension.step}
                      onChange={(value) => {
                        const locked = getAspectLockedDimensions(
                          props.sequencePreview,
                          undefined,
                          value,
                          'height'
                        );

                        props.setSequenceToVideo((current) => ({
                          ...current,
                          customWidth: locked?.width ?? current.customWidth,
                          customHeight: value,
                        }));
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </InspectorFieldRow>

          <InspectorFieldRow label="Upscaler">
            <SelectField
              value={props.sequenceToVideo.upscaler}
              options={props.upscalerOptions}
              onChange={(value) =>
                props.setSequenceToVideo((current) => ({
                  ...current,
                  upscaler: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow
            label="Upscale"
            note={getUpscaleNote(props.sequenceToVideo.upscaler, props.sequenceToVideo.upscaleMode)}
          >
            <SelectField
              value={props.sequenceToVideo.upscaleMode}
              options={UPSCALE_OPTIONS}
              onChange={(value) =>
                props.setSequenceToVideo((current) => ({
                  ...current,
                  upscaleMode: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow
            label="Alpha mode"
            note={getAlphaModeNote(
              props.sequenceToVideo.alphaMode,
              props.sequencePreview?.hasAlpha
            )}
          >
            <SelectField
              value={props.sequenceToVideo.alphaMode}
              options={ALPHA_MODE_OPTIONS}
              onChange={(value) =>
                props.setSequenceToVideo((current) => ({
                  ...current,
                  alphaMode: value,
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
                  outputPath: current.outputPath
                    ? replacePathExtension(current.outputPath, value as VideoFormat)
                    : current.outputPath,
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
              onChange={(value) => {
                props.onVideoToSequenceFpsInput();
                props.setVideoToSequence((current) => ({
                  ...current,
                  fps: value,
                }));
              }}
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

          <InspectorFieldRow label="Resolution" note={videoResolutionUi.note}>
            <div className="space-y-2">
              <SelectField
                value={props.videoToSequence.resolutionMode}
                options={videoResolutionUi.options}
                onChange={(value) => {
                  props.setVideoToSequence((current) => {
                    if (value !== 'custom') {
                      return {
                        ...current,
                        resolutionMode: value,
                      };
                    }

                    const baseResolution = videoResolutionUi.resolved ??
                      getAspectLockedDimensions(
                        props.videoPreview,
                        current.customWidth,
                        undefined,
                        'width'
                      ) ?? {
                        width: current.customWidth || 1920,
                        height: current.customHeight || 1080,
                      };

                    return {
                      ...current,
                      resolutionMode: 'custom',
                      customWidth: baseResolution.width,
                      customHeight: baseResolution.height,
                    };
                  });
                }}
              />

              {props.videoToSequence.resolutionMode === 'custom' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      Width
                    </div>
                    <StepperField
                      value={props.videoToSequence.customWidth ?? 1920}
                      min={RESOLUTION_LIMITS.dimension.min}
                      max={RESOLUTION_LIMITS.dimension.max}
                      step={RESOLUTION_LIMITS.dimension.step}
                      onChange={(value) => {
                        const locked = getAspectLockedDimensions(
                          props.videoPreview,
                          value,
                          undefined,
                          'width'
                        );

                        props.setVideoToSequence((current) => ({
                          ...current,
                          customWidth: value,
                          customHeight: locked?.height ?? current.customHeight,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      Height
                    </div>
                    <StepperField
                      value={props.videoToSequence.customHeight ?? 1080}
                      min={RESOLUTION_LIMITS.dimension.min}
                      max={RESOLUTION_LIMITS.dimension.max}
                      step={RESOLUTION_LIMITS.dimension.step}
                      onChange={(value) => {
                        const locked = getAspectLockedDimensions(
                          props.videoPreview,
                          undefined,
                          value,
                          'height'
                        );

                        props.setVideoToSequence((current) => ({
                          ...current,
                          customWidth: locked?.width ?? current.customWidth,
                          customHeight: value,
                        }));
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </InspectorFieldRow>

          <InspectorFieldRow label="Upscaler">
            <SelectField
              value={props.videoToSequence.upscaler}
              options={props.upscalerOptions}
              onChange={(value) =>
                props.setVideoToSequence((current) => ({
                  ...current,
                  upscaler: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow
            label="Upscale"
            note={getUpscaleNote(props.videoToSequence.upscaler, props.videoToSequence.upscaleMode)}
          >
            <SelectField
              value={props.videoToSequence.upscaleMode}
              options={UPSCALE_OPTIONS}
              onChange={(value) =>
                props.setVideoToSequence((current) => ({
                  ...current,
                  upscaleMode: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow
            label="Alpha mode"
            note={getAlphaModeNote(props.videoToSequence.alphaMode, props.videoPreview?.hasAlpha)}
          >
            <SelectField
              value={props.videoToSequence.alphaMode}
              options={ALPHA_MODE_OPTIONS}
              onChange={(value) =>
                props.setVideoToSequence((current) => ({
                  ...current,
                  alphaMode: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label={singleImageAdjustment.label} note={singleImageAdjustment.note}>
            {singleImageAdjustment.adjustable ? (
              <SliderField
                value={props.videoToSequence.quality}
                min={QUALITY_LIMITS.image.min}
                max={QUALITY_LIMITS.image.max}
                step={QUALITY_LIMITS.image.step}
                valueSuffix="%"
                valueLabel={singleImageAdjustment.valueLabel}
                minLabel={singleImageAdjustment.minLabel}
                maxLabel={singleImageAdjustment.maxLabel}
                onChange={(value) =>
                  props.setVideoToSequence((current) => ({
                    ...current,
                    quality: value,
                  }))
                }
              />
            ) : (
              <div className="field-shell rounded-[8px] px-3 py-2.5 text-sm text-slate-400">
                No adjustable compression for this format.
              </div>
            )}
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
          <InspectorFieldRow
            label="FPS mode"
            note={
              props.batchVideoToSequence.overrideFps
                ? 'Use one FPS value for every source video.'
                : 'Use each source video FPS when available.'
            }
          >
            <SelectField
              value={props.batchVideoToSequence.overrideFps ? 'override' : 'source'}
              options={[
                { value: 'source', label: 'Use source video FPS' },
                { value: 'override', label: 'Override FPS for videos' },
              ]}
              onChange={(value) =>
                props.setBatchVideoToSequence((current) => ({
                  ...current,
                  overrideFps: value === 'override',
                }))
              }
            />
          </InspectorFieldRow>

          {props.batchVideoToSequence.overrideFps && (
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
          )}

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

          <InspectorFieldRow label="Upscaler">
            <SelectField
              value={props.batchVideoToSequence.upscaler}
              options={props.upscalerOptions}
              onChange={(value) =>
                props.setBatchVideoToSequence((current) => ({
                  ...current,
                  upscaler: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow
            label="Upscale"
            note={getUpscaleNote(
              props.batchVideoToSequence.upscaler,
              props.batchVideoToSequence.upscaleMode
            )}
          >
            <SelectField
              value={props.batchVideoToSequence.upscaleMode}
              options={UPSCALE_OPTIONS}
              onChange={(value) =>
                props.setBatchVideoToSequence((current) => ({
                  ...current,
                  upscaleMode: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow
            label="Alpha mode"
            note={getAlphaModeNote(props.batchVideoToSequence.alphaMode, undefined)}
          >
            <SelectField
              value={props.batchVideoToSequence.alphaMode}
              options={ALPHA_MODE_OPTIONS}
              onChange={(value) =>
                props.setBatchVideoToSequence((current) => ({
                  ...current,
                  alphaMode: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow label={batchImageAdjustment.label} note={batchImageAdjustment.note}>
            {batchImageAdjustment.adjustable ? (
              <SliderField
                value={props.batchVideoToSequence.quality}
                min={QUALITY_LIMITS.image.min}
                max={QUALITY_LIMITS.image.max}
                step={QUALITY_LIMITS.image.step}
                valueSuffix="%"
                valueLabel={batchImageAdjustment.valueLabel}
                minLabel={batchImageAdjustment.minLabel}
                maxLabel={batchImageAdjustment.maxLabel}
                onChange={(value) =>
                  props.setBatchVideoToSequence((current) => ({
                    ...current,
                    quality: value,
                  }))
                }
              />
            ) : (
              <div className="field-shell rounded-[8px] px-3 py-2.5 text-sm text-slate-400">
                No adjustable compression for this format.
              </div>
            )}
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

          <InspectorFieldRow label="Upscaler">
            <SelectField
              value={props.batchSequenceToVideo.upscaler}
              options={props.upscalerOptions}
              onChange={(value) =>
                props.setBatchSequenceToVideo((current) => ({
                  ...current,
                  upscaler: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow
            label="Upscale"
            note={getUpscaleNote(
              props.batchSequenceToVideo.upscaler,
              props.batchSequenceToVideo.upscaleMode
            )}
          >
            <SelectField
              value={props.batchSequenceToVideo.upscaleMode}
              options={UPSCALE_OPTIONS}
              onChange={(value) =>
                props.setBatchSequenceToVideo((current) => ({
                  ...current,
                  upscaleMode: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow
            label="Alpha mode"
            note={getAlphaModeNote(props.batchSequenceToVideo.alphaMode, undefined)}
          >
            <SelectField
              value={props.batchSequenceToVideo.alphaMode}
              options={ALPHA_MODE_OPTIONS}
              onChange={(value) =>
                props.setBatchSequenceToVideo((current) => ({
                  ...current,
                  alphaMode: value,
                }))
              }
            />
          </InspectorFieldRow>

          <InspectorFieldRow
            label="Quality"
            note={getVideoQualityNote(
              props.batchSequenceToVideo.format,
              props.batchSequenceToVideo.quality
            )}
          >
            <SliderField
              value={props.batchSequenceToVideo.quality}
              min={QUALITY_LIMITS.video.min}
              max={QUALITY_LIMITS.video.max}
              step={QUALITY_LIMITS.video.step}
              valueSuffix="%"
              minLabel="Smaller file"
              maxLabel="Best quality"
              onChange={(value) =>
                props.setBatchSequenceToVideo((current) => ({
                  ...current,
                  quality: value,
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
