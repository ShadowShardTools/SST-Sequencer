import type { Dispatch, SetStateAction } from 'react';
import { RATE_LIMITS } from '../../../../../shared/formats';
import { InspectorFieldRow, SelectField, StepperField, TextField } from '../../../components/fields';

export function FpsField(props: {
  value: number;
  onChange: (value: number) => void;
  onInput?: () => void;
}) {
  return (
    <InspectorFieldRow label="FPS">
      <StepperField
        value={props.value}
        min={RATE_LIMITS.fps.min}
        max={RATE_LIMITS.fps.max}
        step={RATE_LIMITS.fps.step}
        onChange={(value) => {
          props.onInput?.();
          props.onChange(value);
        }}
      />
    </InspectorFieldRow>
  );
}

export function SpeedField(props: { value: number; onChange: (value: number) => void }) {
  return (
    <InspectorFieldRow label="Speed">
      <StepperField
        value={props.value}
        min={RATE_LIMITS.speed.min}
        max={RATE_LIMITS.speed.max}
        step={RATE_LIMITS.speed.step}
        onChange={props.onChange}
      />
    </InspectorFieldRow>
  );
}

export function OverrideFpsModeField<T extends { overrideFps: boolean }>(props: {
  job: T;
  setJob: Dispatch<SetStateAction<T>>;
}) {
  return (
    <InspectorFieldRow
      label="FPS mode"
      note={
        props.job.overrideFps
          ? 'Use one FPS value for every source video.'
          : 'Use each source video FPS when available.'
      }
    >
      <SelectField
        value={props.job.overrideFps ? 'override' : 'source'}
        options={[
          { value: 'source', label: 'Use source video FPS' },
          { value: 'override', label: 'Override FPS for videos' },
        ]}
        onChange={(value) =>
          props.setJob((current) => ({
            ...current,
            overrideFps: value === 'override',
          }))
        }
      />
    </InspectorFieldRow>
  );
}

export function PrefixField(props: { value: string; onChange: (value: string) => void }) {
  return (
    <InspectorFieldRow label="Prefix">
      <TextField value={props.value} onChange={props.onChange} />
    </InspectorFieldRow>
  );
}

export function StartNumberField(props: { value: number; onChange: (value: number) => void }) {
  return (
    <InspectorFieldRow label="Start #">
      <StepperField value={props.value} min={0} max={999999} step={1} onChange={props.onChange} />
    </InspectorFieldRow>
  );
}
