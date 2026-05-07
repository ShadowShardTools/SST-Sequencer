import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type {
  BatchImageUpscaleJob,
  BatchSequenceToVideoJob,
  BatchVideoToSequenceJob,
  BatchVideoUpscaleJob,
} from '../../../../../shared/jobs';
import { PathPicker, SelectField } from '../../../components/fields';
import { CompactSegmentGroup } from '../../../components/shell';
import { buildPreviewItems } from '../../../lib/formatters';
import { SourceStepCard } from './source-step-card';

type SharedBatchSourceProps = {
  badge: string;
  helper: string;
  sourceReady: boolean;
};

export function BatchVideoToSequenceSourceFields(
  props: SharedBatchSourceProps & {
    job: BatchVideoToSequenceJob;
    setJob: Dispatch<SetStateAction<BatchVideoToSequenceJob>>;
    pickBatchVideoFiles: () => void | Promise<void>;
    pickBatchVideoScanRoot: () => void | Promise<void>;
  }
): ReactNode {
  return (
    <SourceStepCard badge={props.badge} helper={props.helper} sourceReady={props.sourceReady}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CompactSegmentGroup
          label="Input"
          options={[
            {
              label: 'Selected files',
              active: props.job.sourceMode === 'files',
              onClick: () =>
                props.setJob((current) => ({
                  ...current,
                  sourceMode: 'files',
                })),
            },
            {
              label: 'Scan root folder',
              active: props.job.sourceMode === 'scan-root',
              onClick: () =>
                props.setJob((current) => ({
                  ...current,
                  sourceMode: 'scan-root',
                })),
            },
          ]}
        />

        <div className="w-full max-w-[210px]">
          <div className="mb-1 text-sm font-semibold text-white">Recursive scan</div>
          <SelectField
            value={props.job.recursive ? 'enabled' : 'disabled'}
            options={[
              { value: 'enabled', label: 'Enabled' },
              { value: 'disabled', label: 'Disabled' },
            ]}
            onChange={(value) =>
              props.setJob((current) => ({
                ...current,
                recursive: value === 'enabled',
              }))
            }
          />
        </div>
      </div>

      <PathPicker
        label="Batch input"
        displayValue={
          props.job.sourceMode === 'files'
            ? `${props.job.videoPaths?.length ?? 0} video file(s) selected`
            : props.job.scanRoot
        }
        emptyText={props.job.sourceMode === 'files' ? 'No video files selected.' : 'No scan root selected.'}
        previewItems={props.job.sourceMode === 'files' ? buildPreviewItems(props.job.videoPaths, 8) : undefined}
        primaryLabel={props.job.sourceMode === 'files' ? 'Choose videos' : 'Choose root folder'}
        onPrimary={props.job.sourceMode === 'files' ? props.pickBatchVideoFiles : props.pickBatchVideoScanRoot}
      />
    </SourceStepCard>
  );
}

export function BatchImageUpscaleSourceFields(
  props: SharedBatchSourceProps & {
    job: BatchImageUpscaleJob;
    setJob: Dispatch<SetStateAction<BatchImageUpscaleJob>>;
    pickBatchImageFiles: () => void | Promise<void>;
    pickBatchImageScanRoot: () => void | Promise<void>;
  }
): ReactNode {
  return (
    <SourceStepCard badge={props.badge} helper={props.helper} sourceReady={props.sourceReady}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CompactSegmentGroup
          label="Input"
          options={[
            {
              label: 'Selected files',
              active: props.job.sourceMode === 'files',
              onClick: () =>
                props.setJob((current) => ({
                  ...current,
                  sourceMode: 'files',
                })),
            },
            {
              label: 'Scan root folder',
              active: props.job.sourceMode === 'scan-root',
              onClick: () =>
                props.setJob((current) => ({
                  ...current,
                  sourceMode: 'scan-root',
                })),
            },
          ]}
        />

        <div className="w-full max-w-[210px]">
          <div className="mb-1 text-sm font-semibold text-white">Recursive scan</div>
          <SelectField
            value={props.job.recursive ? 'enabled' : 'disabled'}
            options={[
              { value: 'enabled', label: 'Enabled' },
              { value: 'disabled', label: 'Disabled' },
            ]}
            onChange={(value) =>
              props.setJob((current) => ({
                ...current,
                recursive: value === 'enabled',
              }))
            }
          />
        </div>
      </div>

      <PathPicker
        label="Batch input"
        displayValue={
          props.job.sourceMode === 'files'
            ? `${props.job.imagePaths?.length ?? 0} image file(s) selected`
            : props.job.scanRoot
        }
        emptyText={props.job.sourceMode === 'files' ? 'No image files selected.' : 'No scan root selected.'}
        previewItems={props.job.sourceMode === 'files' ? buildPreviewItems(props.job.imagePaths, 8) : undefined}
        primaryLabel={props.job.sourceMode === 'files' ? 'Choose images' : 'Choose root folder'}
        onPrimary={props.job.sourceMode === 'files' ? props.pickBatchImageFiles : props.pickBatchImageScanRoot}
      />
    </SourceStepCard>
  );
}

export function BatchVideoUpscaleSourceFields(
  props: SharedBatchSourceProps & {
    job: BatchVideoUpscaleJob;
    setJob: Dispatch<SetStateAction<BatchVideoUpscaleJob>>;
    pickBatchVideoFiles: () => void | Promise<void>;
    pickBatchVideoScanRoot: () => void | Promise<void>;
  }
): ReactNode {
  return (
    <SourceStepCard badge={props.badge} helper={props.helper} sourceReady={props.sourceReady}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CompactSegmentGroup
          label="Input"
          options={[
            {
              label: 'Selected files',
              active: props.job.sourceMode === 'files',
              onClick: () =>
                props.setJob((current) => ({
                  ...current,
                  sourceMode: 'files',
                })),
            },
            {
              label: 'Scan root folder',
              active: props.job.sourceMode === 'scan-root',
              onClick: () =>
                props.setJob((current) => ({
                  ...current,
                  sourceMode: 'scan-root',
                })),
            },
          ]}
        />

        <div className="w-full max-w-[210px]">
          <div className="mb-1 text-sm font-semibold text-white">Recursive scan</div>
          <SelectField
            value={props.job.recursive ? 'enabled' : 'disabled'}
            options={[
              { value: 'enabled', label: 'Enabled' },
              { value: 'disabled', label: 'Disabled' },
            ]}
            onChange={(value) =>
              props.setJob((current) => ({
                ...current,
                recursive: value === 'enabled',
              }))
            }
          />
        </div>
      </div>

      <PathPicker
        label="Batch input"
        displayValue={
          props.job.sourceMode === 'files'
            ? `${props.job.videoPaths?.length ?? 0} video file(s) selected`
            : props.job.scanRoot
        }
        emptyText={props.job.sourceMode === 'files' ? 'No video files selected.' : 'No scan root selected.'}
        previewItems={props.job.sourceMode === 'files' ? buildPreviewItems(props.job.videoPaths, 8) : undefined}
        primaryLabel={props.job.sourceMode === 'files' ? 'Choose videos' : 'Choose root folder'}
        onPrimary={props.job.sourceMode === 'files' ? props.pickBatchVideoFiles : props.pickBatchVideoScanRoot}
      />
    </SourceStepCard>
  );
}

export function BatchSequenceToVideoSourceFields(
  props: SharedBatchSourceProps & {
    job: BatchSequenceToVideoJob;
    setJob: Dispatch<SetStateAction<BatchSequenceToVideoJob>>;
    pickBatchSequenceFolders: () => void | Promise<void>;
    pickBatchSequenceScanRoot: () => void | Promise<void>;
  }
): ReactNode {
  return (
    <SourceStepCard badge={props.badge} helper={props.helper} sourceReady={props.sourceReady}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CompactSegmentGroup
          label="Input"
          options={[
            {
              label: 'Selected folders',
              active: props.job.sourceMode === 'folders',
              onClick: () =>
                props.setJob((current) => ({
                  ...current,
                  sourceMode: 'folders',
                })),
            },
            {
              label: 'Scan root folder',
              active: props.job.sourceMode === 'scan-root',
              onClick: () =>
                props.setJob((current) => ({
                  ...current,
                  sourceMode: 'scan-root',
                })),
            },
          ]}
        />

        <div className="w-full max-w-[210px]">
          <div className="mb-1 text-sm font-semibold text-white">Recursive scan</div>
          <SelectField
            value={props.job.recursive ? 'enabled' : 'disabled'}
            options={[
              { value: 'enabled', label: 'Enabled' },
              { value: 'disabled', label: 'Disabled' },
            ]}
            onChange={(value) =>
              props.setJob((current) => ({
                ...current,
                recursive: value === 'enabled',
              }))
            }
          />
        </div>
      </div>

      <PathPicker
        label="Batch input"
        displayValue={
          props.job.sourceMode === 'folders'
            ? `${props.job.sequenceFolders?.length ?? 0} folder(s) selected`
            : props.job.scanRoot
        }
        emptyText={
          props.job.sourceMode === 'folders' ? 'No sequence folders selected.' : 'No scan root selected.'
        }
        previewItems={
          props.job.sourceMode === 'folders' ? buildPreviewItems(props.job.sequenceFolders, 8) : undefined
        }
        primaryLabel={props.job.sourceMode === 'folders' ? 'Choose folders' : 'Choose root folder'}
        onPrimary={
          props.job.sourceMode === 'folders'
            ? props.pickBatchSequenceFolders
            : props.pickBatchSequenceScanRoot
        }
      />
    </SourceStepCard>
  );
}
