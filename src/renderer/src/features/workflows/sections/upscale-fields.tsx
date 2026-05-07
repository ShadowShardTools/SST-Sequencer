import type { Dispatch, SetStateAction } from 'react';
import {
  ALPHA_MODE_OPTIONS,
  createDefaultUpscalerConfig,
  getUpscalerNote,
  getSupportedUpscaleOptionsForUpscaler,
  getUpscalerConfigFields,
  getUpscalerTypeFromConfig,
  normalizeUpscaleModeForUpscaler,
  type AlphaMode,
  type SelectOption,
  type UpscaleMode,
  type UpscalerConfig,
  type UpscalerType,
} from '../../../../../shared/upscalers/registry';
import { InspectorFieldRow, SelectField } from '../../../components/fields';
import { getAlphaModeNote } from '../../../lib/alpha';

type UpscaleState = {
  upscalerConfig: UpscalerConfig;
  upscaleMode: UpscaleMode;
  alphaMode: AlphaMode;
};

function UpscalerConfigFields<T extends UpscaleState>(props: {
  job: T;
  setJob: Dispatch<SetStateAction<T>>;
}) {
  const configFields = getUpscalerConfigFields(props.job.upscalerConfig);
  if (configFields.length === 0) {
    return null;
  }

  return (
    <>
      {configFields.map((field) => (
        <InspectorFieldRow
          key={`${props.job.upscalerConfig.kind}-${field.key}`}
          label={field.label}
          note={field.note}
        >
          <SelectField
            value={(props.job.upscalerConfig as Record<string, string>)[field.key] ?? ''}
            options={field.options}
            onChange={(value) =>
              props.setJob((current) => ({
                ...current,
                upscalerConfig: {
                  ...current.upscalerConfig,
                  [field.key]: value,
                } as UpscalerConfig,
              }))
            }
          />
        </InspectorFieldRow>
      ))}
    </>
  );
}

export function UpscaleFields<T extends UpscaleState>(props: {
  job: T;
  setJob: Dispatch<SetStateAction<T>>;
  upscalerOptions: ReadonlyArray<SelectOption<UpscalerType>>;
  hasAlpha: boolean | undefined;
}) {
  const upscaler = getUpscalerTypeFromConfig(props.job.upscalerConfig);
  const upscaleOptions = getSupportedUpscaleOptionsForUpscaler(upscaler);

  return (
    <>
      <InspectorFieldRow label="Upscaler" note={getUpscalerNote(upscaler, props.job.upscaleMode)}>
        <SelectField
          value={upscaler}
          options={props.upscalerOptions}
          onChange={(value) =>
            props.setJob((current) => ({
              ...current,
              upscalerConfig: createDefaultUpscalerConfig(value),
              upscaleMode: normalizeUpscaleModeForUpscaler(value, current.upscaleMode),
            }))
          }
        />
      </InspectorFieldRow>

      <UpscalerConfigFields job={props.job} setJob={props.setJob} />

      <InspectorFieldRow label="Upscale">
        <SelectField
          value={props.job.upscaleMode}
          options={upscaleOptions}
          onChange={(value) =>
            props.setJob((current) => ({
              ...current,
              upscaleMode: value,
            }))
          }
        />
      </InspectorFieldRow>

      <InspectorFieldRow label="Alpha mode" note={getAlphaModeNote(props.job.alphaMode, props.hasAlpha)}>
        <SelectField
          value={props.job.alphaMode}
          options={ALPHA_MODE_OPTIONS}
          onChange={(value) =>
            props.setJob((current) => ({
              ...current,
              alphaMode: value,
            }))
          }
        />
      </InspectorFieldRow>
    </>
  );
}
