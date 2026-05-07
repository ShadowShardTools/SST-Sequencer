import type { BatchOutputMode } from '../../../../../shared/formats';
import { BatchOutputPicker, InspectorFieldRow, OutputField } from '../../../components/fields';

export function FileOutputField(props: {
  value?: string;
  emptyText: string;
  detailText: string;
  pickLabel: string;
  onPick: () => void | Promise<void>;
  onClear: () => void;
}) {
  return (
    <InspectorFieldRow label="Output path">
      <OutputField
        value={props.value}
        emptyText={props.emptyText}
        detailText={props.detailText}
        pickLabel={props.pickLabel}
        onPick={props.onPick}
        clearLabel="Auto"
        onClear={props.onClear}
      />
    </InspectorFieldRow>
  );
}

export function BatchOutputField(props: {
  outputMode: BatchOutputMode;
  outputRoot?: string;
  onModeChange: (mode: BatchOutputMode) => void;
  onPickRoot: () => void | Promise<void>;
  onClearRoot: () => void;
  forEachDetail: string;
  customDetail: string;
}) {
  return (
    <InspectorFieldRow label="Output path">
      <BatchOutputPicker
        outputMode={props.outputMode}
        outputRoot={props.outputRoot}
        onModeChange={props.onModeChange}
        onPickRoot={props.onPickRoot}
        onClearRoot={props.onClearRoot}
        forEachDetail={props.forEachDetail}
        customDetail={props.customDetail}
      />
    </InspectorFieldRow>
  );
}
