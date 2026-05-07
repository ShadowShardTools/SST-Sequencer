import { QUALITY_LIMITS, IMAGE_FORMAT_OPTIONS, VIDEO_FORMAT_OPTIONS, type ImageFormat, type VideoFormat } from '../../../../../shared/formats';
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
