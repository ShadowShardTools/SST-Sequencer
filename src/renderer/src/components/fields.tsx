import { useState, type DragEvent, type ReactNode } from 'react';
import type { BatchOutputMode, SelectOption } from '../../../shared/formats';
import { clampToRange, roundToStep, trimNumber } from '../lib/media';
import { FolderIcon, VideoIcon } from './icons';
import { MetaChip } from './shell';

export type DropNotice = {
  tone: 'error';
  text: string;
};

export function SingleDropZone(props: {
  icon: 'folder' | 'video';
  title: string;
  description: string;
  acceptedLabel: string;
  browseActions: Array<{
    label: string;
    onClick: () => void | Promise<void>;
  }>;
  onDropTransfer: (dataTransfer: DataTransfer) => Promise<void>;
}) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDrop(event: DragEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    setActive(false);
    setBusy(true);

    try {
      await props.onDropTransfer(event.dataTransfer);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        setActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setActive(false);
      }}
      onDrop={(event) => void handleDrop(event)}
      className={`dropzone flex min-h-[120px] flex-col items-center justify-center gap-1.5 px-4 py-4 text-center transition ${
        active ? 'dropzone-active' : ''
      } ${busy ? 'opacity-75' : ''}`}
    >
      <div className="mb-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-slate-300">
        {props.icon === 'folder' ? <FolderIcon /> : <VideoIcon />}
      </div>
      <div className="text-sm font-semibold text-white">{props.title}</div>
      <div className="text-sm text-slate-400">
        {busy ? 'Reading dropped items...' : props.description}
      </div>
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
        {props.acceptedLabel}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-sm text-slate-400">
        <span>Or click to browse</span>
        {props.browseActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => void action.onClick()}
            className="text-[#7fb0ff] transition hover:text-[#a5c6ff] focus-visible:text-[#a5c6ff]"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DropNoticeBanner(props: { notice: DropNotice }) {
  return (
    <div className="rounded-[8px] border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
      {props.notice.text}
    </div>
  );
}

export function PathPicker(props: {
  label: string;
  displayValue?: string;
  emptyText: string;
  previewItems?: string[];
  primaryLabel: string;
  onPrimary: () => void | Promise<void>;
}) {
  const hasValue = Boolean(props.displayValue?.trim());

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-white">{props.label}</div>
      <div className="field-shell rounded-[8px] p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className={`mono text-sm ${hasValue ? 'text-slate-100' : 'text-slate-500'}`}>
              {hasValue ? props.displayValue : props.emptyText}
            </div>
            {props.previewItems && props.previewItems.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {props.previewItems.map((item) => (
                  <MetaChip key={item} label={item} />
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void props.onPrimary()}
            className="secondary-button rounded-[8px] px-3.5 py-2 text-sm font-medium"
          >
            {props.primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function InspectorFieldRow(props: { label: string; note?: string; children: ReactNode }) {
  return (
    <div className="space-y-2 border-b border-white/6 pb-3 last:border-b-0 last:pb-0">
      {props.label && <div className="text-sm font-semibold text-white">{props.label}</div>}
      {props.children}
      {props.note && <div className="text-xs leading-5 text-slate-400">{props.note}</div>}
    </div>
  );
}

export function StepperField(props: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  function commit(value: number): void {
    props.onChange(clampToRange(roundToStep(value, props.step), props.min, props.max));
  }

  return (
    <div className="field-shell flex items-center rounded-[8px]">
      <button
        type="button"
        onClick={() => commit(props.value - props.step)}
        className="secondary-button rounded-[8px] border-0 px-3 py-2 text-base leading-none"
      >
        -
      </button>
      <input
        type="number"
        min={props.min}
        max={props.max}
        step={props.step}
        value={trimNumber(props.value)}
        onChange={(event) => {
          const raw = event.target.value;
          if (!raw.trim()) {
            return;
          }
          const numeric = Number(raw);
          if (Number.isFinite(numeric)) {
            props.onChange(numeric);
          }
        }}
        onBlur={(event) => {
          const numeric = Number(event.target.value);
          if (Number.isFinite(numeric)) {
            commit(numeric);
          } else {
            commit(props.value);
          }
        }}
        className="w-full bg-transparent px-2 py-2 text-center text-sm text-slate-100 outline-none"
      />
      <button
        type="button"
        onClick={() => commit(props.value + props.step)}
        className="secondary-button rounded-[8px] border-0 px-3 py-2 text-base leading-none"
      >
        +
      </button>
    </div>
  );
}

export function SliderField(props: {
  value: number;
  min: number;
  max: number;
  step: number;
  valueSuffix?: string;
  valueLabel?: string;
  minLabel?: string;
  maxLabel?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="field-shell rounded-[8px] px-3 py-3">
        <input
          type="range"
          min={props.min}
          max={props.max}
          step={props.step}
          value={props.value}
          onChange={(event) => props.onChange(Number(event.target.value))}
          className="slider-field w-full"
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">{props.minLabel ?? String(props.min)}</span>
        <span className="font-semibold text-slate-100">
          {props.valueLabel ?? `${trimNumber(props.value)}${props.valueSuffix ?? ''}`}
        </span>
        <span className="text-slate-500">{props.maxLabel ?? String(props.max)}</span>
      </div>
    </div>
  );
}

export function TextField(props: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="field-shell rounded-[8px] px-3 py-2.5">
      <input
        type="text"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full bg-transparent text-sm text-slate-100 outline-none"
      />
    </div>
  );
}

export function SelectField<TValue extends string>(props: {
  value: TValue;
  options: ReadonlyArray<SelectOption<TValue>>;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="field-shell rounded-[8px] px-3 py-2.5">
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value as TValue)}
        className="w-full bg-transparent text-sm text-slate-100 outline-none"
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#141418]">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ToggleField(props: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="field-shell flex items-center gap-3 rounded-[8px] px-3 py-2.5">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        className="h-4.5 w-4.5 accent-[#2563eb]"
      />
      <div>
        <div className="text-sm font-medium text-slate-100">{props.label}</div>
        <div className="text-sm text-slate-400">{props.description}</div>
      </div>
    </label>
  );
}

export function OutputField(props: {
  value?: string;
  emptyText: string;
  detailText: string;
  pickLabel: string;
  onPick: () => void | Promise<void>;
  clearLabel?: string;
  onClear?: () => void;
}) {
  const hasValue = Boolean(props.value?.trim());

  return (
    <div className="field-shell rounded-[8px] p-2.5">
      <div className={`mono text-sm ${hasValue ? 'text-slate-100' : 'text-slate-500'}`}>
        {hasValue ? props.value : props.emptyText}
      </div>
      <div className="mt-1 text-xs text-slate-400">{props.detailText}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {hasValue && props.clearLabel && props.onClear && (
          <button
            type="button"
            onClick={props.onClear}
            className="secondary-button rounded-[8px] px-3 py-1.5 text-sm font-medium"
          >
            {props.clearLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => void props.onPick()}
          className="secondary-button rounded-[8px] px-3 py-1.5 text-sm font-medium"
        >
          {props.pickLabel}
        </button>
      </div>
    </div>
  );
}

export function BatchOutputPicker(props: {
  outputMode: BatchOutputMode;
  outputRoot?: string;
  onModeChange: (mode: BatchOutputMode) => void;
  onPickRoot: () => void | Promise<void>;
  onClearRoot: () => void;
  forEachDetail: string;
  customDetail: string;
}) {
  return (
    <div className="space-y-2">
      <SelectField
        value={props.outputMode}
        options={[
          { value: 'for-each', label: 'For each source' },
          { value: 'custom-root', label: 'Selected export path' },
        ]}
        onChange={props.onModeChange}
      />

      {props.outputMode === 'for-each' ? (
        <div className="px-1 text-xs leading-5 text-slate-400">
          {props.forEachDetail}
        </div>
      ) : (
        <OutputField
          value={props.outputRoot}
          emptyText="No export folder selected"
          detailText={props.customDetail}
          pickLabel="Choose folder"
          onPick={props.onPickRoot}
          clearLabel="Clear"
          onClear={props.onClearRoot}
        />
      )}
    </div>
  );
}
