import type { WorkflowStepState } from '../../components/shell';
import type { ActivityState, ValidationState } from './types';

export function buildWorkflowSteps(
  validation: ValidationState,
  activity: ActivityState
): WorkflowStepState[] {
  const renderDone = activity.success === true && !activity.running;

  if (!validation.sourceReady) {
    return [
      { key: 'source', label: 'Source', status: 'current' },
      { key: 'parameters', label: 'Parameters', status: 'future' },
      { key: 'output', label: 'Output', status: 'future' },
      { key: 'render', label: 'Render', status: 'future' },
    ];
  }

  if (!validation.parametersReady) {
    return [
      { key: 'source', label: 'Source', status: 'done' },
      { key: 'parameters', label: 'Parameters', status: 'current' },
      { key: 'output', label: 'Output', status: 'future' },
      { key: 'render', label: 'Render', status: 'future' },
    ];
  }

  if (!validation.outputReady) {
    return [
      { key: 'source', label: 'Source', status: 'done' },
      { key: 'parameters', label: 'Parameters', status: 'done' },
      { key: 'output', label: 'Output', status: 'current' },
      { key: 'render', label: 'Render', status: 'future' },
    ];
  }

  if (renderDone) {
    return [
      { key: 'source', label: 'Source', status: 'done' },
      { key: 'parameters', label: 'Parameters', status: 'done' },
      { key: 'output', label: 'Output', status: 'done' },
      { key: 'render', label: 'Render', status: 'done' },
    ];
  }

  return [
    { key: 'source', label: 'Source', status: 'done' },
    { key: 'parameters', label: 'Parameters', status: 'done' },
    { key: 'output', label: 'Output', status: 'done' },
    { key: 'render', label: 'Render', status: 'current' },
  ];
}

export function getFooterStatus(activity: ActivityState): {
  label: string;
  dotClass: string;
} {
  if (activity.running) {
    return {
      label: 'Processing',
      dotClass: 'bg-amber-400',
    };
  }
  if (activity.success === false) {
    return {
      label: 'Error',
      dotClass: 'bg-rose-400',
    };
  }
  if (activity.success === true) {
    return {
      label: 'Done',
      dotClass: 'bg-emerald-400',
    };
  }
  return {
    label: 'Idle',
    dotClass: 'bg-slate-500',
  };
}
