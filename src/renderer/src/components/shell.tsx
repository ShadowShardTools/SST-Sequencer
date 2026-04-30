import type { ReactNode } from 'react';
import { CheckIcon } from './icons';

export type WorkflowStepState = {
  key: 'source' | 'parameters' | 'output' | 'render';
  label: string;
  status: 'done' | 'current' | 'future';
};

type SegmentOption = {
  label: string;
  active: boolean;
  onClick: () => void;
};

export function Panel(props: { className?: string; children: ReactNode }) {
  return (
    <section className={`app-surface p-3.5 ${props.className ?? ''}`}>{props.children}</section>
  );
}

export function CompactSegmentGroup(props: { label: string; options: SegmentOption[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {props.label}
      </span>
      <div className="segmented-shell inline-flex flex-wrap items-center gap-1 rounded-[8px] p-1">
        {props.options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={option.onClick}
            aria-pressed={option.active}
            className={`segmented-button rounded-[6px] px-3 py-1.5 text-sm transition ${
              option.active ? 'segmented-button-active text-white' : 'text-slate-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProgressSteps(props: { steps: WorkflowStepState[] }) {
  return (
    <div className="rounded-[8px] border border-white/8 bg-[#141418] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {props.steps.map((step, index) => (
          <div key={step.key} className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-[8px] px-2 py-1">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[12px] font-semibold ${
                  step.status === 'done'
                    ? 'border-[#34d399] bg-[#34d399] text-[#08130f]'
                    : step.status === 'current'
                      ? 'border-[#2563eb] bg-[#2563eb] text-white'
                      : 'border-[#2a2a3a] bg-transparent text-slate-500'
                }`}
              >
                {step.status === 'done' ? <CheckIcon /> : index + 1}
              </span>
              <span
                className={`text-sm font-medium ${
                  step.status === 'future' ? 'text-slate-500' : 'text-slate-100'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < props.steps.length - 1 && <span className="text-slate-600">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionCard(props: {
  step: string;
  title: string;
  badge: string;
  helper: string;
  helperTone: 'muted' | 'warning';
  children: ReactNode;
}) {
  return (
    <section className="rounded-[8px] border border-white/8 bg-[#15161c] p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-white/8 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#2a2a3a] bg-[#101117] text-xs font-semibold text-white">
            {props.step}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{props.title}</div>
            <div
              className={`mt-1 text-sm ${
                props.helperTone === 'warning' ? 'text-amber-300' : 'text-slate-400'
              }`}
            >
              {props.helper}
            </div>
          </div>
        </div>
        <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-slate-300">
          {props.badge}
        </span>
      </div>
      <div className="space-y-3">{props.children}</div>
    </section>
  );
}

export function MetaChip(props: { label: string }) {
  return (
    <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300">
      {props.label}
    </span>
  );
}
