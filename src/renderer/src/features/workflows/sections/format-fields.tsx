import {
  BACKGROUND_REMOVE_MODEL_OPTIONS,
  QUALITY_LIMITS,
  IMAGE_FORMAT_OPTIONS,
  VIDEO_FORMAT_OPTIONS,
  type BackgroundRemoveModel,
  type ImageFormat,
  type VideoFormat,
} from '../../../../../shared/formats';
import { InspectorFieldRow, SelectField, SliderField } from '../../../components/fields';
import { getImageAdjustmentUi, getVideoQualityNote } from '../../../lib/quality';

export function VideoQualityField(props: {
  format: VideoFormat;
  quality: number;
  onChange: (value: number) => void;
}) {
  return (
    <InspectorFieldRow label="Quality" note={getVideoQualityNote(props.format, props.quality)}>
      <SliderField
        value={props.quality}
        min={QUALITY_LIMITS.video.min}
        max={QUALITY_LIMITS.video.max}
        step={QUALITY_LIMITS.video.step}
        valueSuffix="%"
        minLabel="Smaller file"
        maxLabel="Best quality"
        onChange={props.onChange}
      />
    </InspectorFieldRow>
  );
}

export function ImageAdjustmentField(props: {
  format: ImageFormat;
  quality: number;
  onChange: (value: number) => void;
}) {
  const ui = getImageAdjustmentUi(props.format, props.quality);

  return (
    <InspectorFieldRow label={ui.label} note={ui.note}>
      {ui.adjustable ? (
        <SliderField
          value={props.quality}
          min={QUALITY_LIMITS.image.min}
          max={QUALITY_LIMITS.image.max}
          step={QUALITY_LIMITS.image.step}
          valueSuffix="%"
          valueLabel={ui.valueLabel}
          minLabel={ui.minLabel}
          maxLabel={ui.maxLabel}
          onChange={props.onChange}
        />
      ) : (
        <div className="field-shell rounded-[8px] px-3 py-2.5 text-sm text-slate-400">
          No adjustable compression for this format.
        </div>
      )}
    </InspectorFieldRow>
  );
}

export function VideoFormatField(props: {
  value: VideoFormat;
  onChange: (value: VideoFormat) => void;
  note?: string;
}) {
  return (
    <InspectorFieldRow label="Format" note={props.note}>
      <SelectField
        value={props.value}
        options={VIDEO_FORMAT_OPTIONS}
        onChange={(value) => props.onChange(value as VideoFormat)}
      />
    </InspectorFieldRow>
  );
}

export function ImageFormatField(props: {
  value: ImageFormat;
  onChange: (value: ImageFormat) => void;
}) {
  return (
    <InspectorFieldRow label="Format">
      <SelectField
        value={props.value}
        options={IMAGE_FORMAT_OPTIONS}
        onChange={(value) => props.onChange(value as ImageFormat)}
      />
    </InspectorFieldRow>
  );
}

type BackgroundRemoveState = {
  backgroundRemove: boolean;
  backgroundRemoveModel: BackgroundRemoveModel;
};

export function BackgroundRemoveField<T extends BackgroundRemoveState>(props: {
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <>
      <InspectorFieldRow
        label="Background remove"
        note="Run AI cutout on the source image or prepared frames before upscale and export. Use an alpha-capable output format if you want transparent results."
      >
        <SelectField
          value={props.value.backgroundRemove ? 'enabled' : 'disabled'}
          options={[
            { value: 'disabled', label: 'Disabled' },
            { value: 'enabled', label: 'Enabled' },
          ]}
          onChange={(value) =>
            props.onChange({
              ...props.value,
              backgroundRemove: value === 'enabled',
            })
          }
        />
      </InspectorFieldRow>

      {props.value.backgroundRemove && (
        <InspectorFieldRow
          label="Cutout model"
          note="Choose the segmentation model used by the AI background remover."
        >
          <SelectField
            value={props.value.backgroundRemoveModel}
            options={BACKGROUND_REMOVE_MODEL_OPTIONS}
            onChange={(value) =>
              props.onChange({
                ...props.value,
                backgroundRemoveModel: value as BackgroundRemoveModel,
              })
            }
          />
        </InspectorFieldRow>
      )}
    </>
  );
}
