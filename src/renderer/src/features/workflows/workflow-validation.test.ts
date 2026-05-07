import { describe, expect, it } from 'vitest';
import {
  initialBatchImageUpscale,
  initialBatchVideoToSequence,
  initialBatchSequenceToVideo,
  initialImageUpscale,
  initialSequenceToVideo,
  initialBatchVideoUpscale,
  initialVideoToSequence,
  initialVideoUpscale,
} from './defaults';
import { validateWorkflow } from './workflow-validation';
import type { UpscalerConfig } from '../../../../shared/upscalers/registry';
import type { WorkflowJobsState } from './types';

function createWorkflowState(overrides?: Partial<WorkflowJobsState>): WorkflowJobsState {
  return {
    sequenceToVideo: structuredClone(initialSequenceToVideo),
    videoToSequence: structuredClone(initialVideoToSequence),
    imageUpscale: structuredClone(initialImageUpscale),
    videoUpscale: structuredClone(initialVideoUpscale),
    batchImageUpscale: structuredClone(initialBatchImageUpscale),
    batchVideoUpscale: structuredClone(initialBatchVideoUpscale),
    batchVideoToSequence: structuredClone(initialBatchVideoToSequence),
    batchSequenceToVideo: structuredClone(initialBatchSequenceToVideo),
    ...overrides,
  };
}

describe('workflow validation', () => {
  it('marks sequence-to-video ready once a source is selected', () => {
    const state = createWorkflowState({
      sequenceToVideo: {
        ...structuredClone(initialSequenceToVideo),
        sequenceFolder: 'D:\\frames',
      },
    });

    const validation = validateWorkflow('sequence-to-video', state);

    expect(validation.ready).toBe(true);
    expect(validation.sourceReady).toBe(true);
    expect(validation.parametersReady).toBe(true);
    expect(validation.blocking).toEqual([]);
  });

  it('surfaces invalid upscaler config errors through workflow validation', () => {
    const state = createWorkflowState({
      sequenceToVideo: {
        ...structuredClone(initialSequenceToVideo),
        sequenceFolder: 'D:\\frames',
        upscalerConfig: {
          kind: 'realcugan',
          variant: 'turbo',
        } as unknown as UpscalerConfig,
      },
    });

    const validation = validateWorkflow('sequence-to-video', state);

    expect(validation.ready).toBe(false);
    expect(validation.parametersReady).toBe(false);
    expect(validation.blocking).toContain('Real-CUGAN variant is invalid.');
  });

  it('requires an export folder for batch selected export path mode', () => {
    const state = createWorkflowState({
      batchVideoToSequence: {
        ...structuredClone(initialBatchVideoToSequence),
        videoPaths: ['D:\\clip.mp4'],
        outputMode: 'custom-root',
        outputRoot: '',
      },
    });

    const validation = validateWorkflow('batch-video-to-sequence', state);

    expect(validation.sourceReady).toBe(true);
    expect(validation.parametersReady).toBe(true);
    expect(validation.outputReady).toBe(false);
    expect(validation.blocking).toContain('Choose an export folder for selected export path.');
  });

  it('marks image-upscale ready once images are selected', () => {
    const state = createWorkflowState({
      imageUpscale: {
        ...structuredClone(initialImageUpscale),
        imagePaths: ['D:\\sprite.png'],
      },
    });

    const validation = validateWorkflow('image-upscale', state);

    expect(validation.ready).toBe(true);
    expect(validation.sourceReady).toBe(true);
    expect(validation.parametersReady).toBe(true);
    expect(validation.blocking).toEqual([]);
  });
});
