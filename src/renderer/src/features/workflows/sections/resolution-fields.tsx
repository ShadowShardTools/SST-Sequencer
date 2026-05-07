import type { Dispatch, SetStateAction } from 'react';
import { RESOLUTION_LIMITS, type ResolutionDimensions, type ResolutionSettings } from '../../../../../shared/resolution';
import { InspectorFieldRow, SelectField, StepperField } from '../../../components/fields';
import { getAspectLockedDimensions, type ResolutionControlUi } from '../../../lib/resolution-ui';

export function ResolutionField<T extends ResolutionSettings>(props: {
  settings: T;
  setSettings: Dispatch<SetStateAction<T>>;
  ui: ResolutionControlUi;
  source: ResolutionDimensions | null;
  lockAspect: boolean;
}) {
  return (
    <InspectorFieldRow label="Resolution" note={props.ui.note}>
      <div className="space-y-2">
        <SelectField
          value={props.settings.resolutionMode}
          options={props.ui.options}
          onChange={(value) => {
            props.setSettings((current) => {
              if (value !== 'custom') {
                return {
                  ...current,
                  resolutionMode: value,
                };
              }

              const baseResolution =
                props.ui.resolved ??
                (props.lockAspect
                  ? getAspectLockedDimensions(props.source, current.customWidth, undefined, 'width')
                  : null) ?? {
                  width: current.customWidth ?? 1920,
                  height: current.customHeight ?? 1080,
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

        {props.settings.resolutionMode === 'custom' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Width
              </div>
              <StepperField
                value={props.settings.customWidth ?? 1920}
                min={RESOLUTION_LIMITS.dimension.min}
                max={RESOLUTION_LIMITS.dimension.max}
                step={RESOLUTION_LIMITS.dimension.step}
                onChange={(value) => {
                  const locked = props.lockAspect
                    ? getAspectLockedDimensions(props.source, value, undefined, 'width')
                    : null;

                  props.setSettings((current) => ({
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
                value={props.settings.customHeight ?? 1080}
                min={RESOLUTION_LIMITS.dimension.min}
                max={RESOLUTION_LIMITS.dimension.max}
                step={RESOLUTION_LIMITS.dimension.step}
                onChange={(value) => {
                  const locked = props.lockAspect
                    ? getAspectLockedDimensions(props.source, undefined, value, 'height')
                    : null;

                  props.setSettings((current) => ({
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
  );
}
