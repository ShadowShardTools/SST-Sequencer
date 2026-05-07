import { getUpscaleFactor, type SelectOption, type UpscaleMode } from '../../../shared/upscalers/registry';
import {
  resolveResolution,
  type ResolutionDimensions,
  type ResolutionMode,
  type ResolutionSettings,
  type ResolvedResolution,
} from '../../../shared/resolution';
import { formatResolution } from './formatters';

export type ResolutionControlUi = {
  options: Array<SelectOption<ResolutionMode>>;
  note: string;
  resolved: ResolvedResolution | null;
};

export function getResolutionControlUi(
  settings: ResolutionSettings,
  source: ResolutionDimensions | null,
  outputKind: 'video' | 'images',
  context: 'single' | 'batch' = 'single'
): ResolutionControlUi {
  const resolved = resolveResolution(settings, source ?? {}, {
    enforceEven: outputKind === 'video',
  });
  const sourceLabel = formatResolution(source?.width, source?.height);

  const options: Array<SelectOption<ResolutionMode>> = [
    {
      value: 'source',
      label: sourceLabel ? `Source (${sourceLabel})` : 'Source resolution',
    },
    {
      value: 'half',
      label: buildResolutionOptionLabel(
        '1/2 of source',
        source,
        { resolutionMode: 'half' },
        outputKind
      ),
    },
    {
      value: 'quarter',
      label: buildResolutionOptionLabel(
        '1/4 of source',
        source,
        { resolutionMode: 'quarter' },
        outputKind
      ),
    },
    {
      value: 'eighth',
      label: buildResolutionOptionLabel(
        '1/8 of source',
        source,
        { resolutionMode: 'eighth' },
        outputKind
      ),
    },
    {
      value: 'custom',
      label: 'Custom',
    },
  ];

  if (!resolved) {
    return {
      options,
      resolved: null,
      note:
        context === 'batch'
          ? settings.resolutionMode === 'source'
            ? 'Each batch item keeps its source resolution.'
            : 'Each batch item is resized relative to its own source resolution.'
          : settings.resolutionMode === 'source'
            ? 'Uses the source resolution once a source is loaded.'
            : 'Load a source to preview the output resolution.',
    };
  }

  const outputLabel = formatResolution(resolved.width, resolved.height) ?? 'Unknown';
  if (settings.resolutionMode === 'source') {
    return {
      options,
      resolved,
      note: `Output resolution: ${outputLabel}.`,
    };
  }

  if (settings.resolutionMode === 'custom') {
    return {
      options,
      resolved,
      note: `Custom output resolution: ${outputLabel}. Width and height stay aligned to the source aspect ratio while you edit them.`,
    };
  }

  return {
    options,
    resolved,
    note: `Output resolution: ${outputLabel}.`,
  };
}

export function getAspectLockedDimensions(
  source: ResolutionDimensions | null,
  nextWidth: number | undefined,
  nextHeight: number | undefined,
  lockedEdge: 'width' | 'height'
): ResolvedResolution | null {
  if (!source?.width || !source.height) {
    return null;
  }

  if (lockedEdge === 'width' && nextWidth && nextWidth > 0) {
    return {
      width: nextWidth,
      height: Math.max(2, Math.round(((nextWidth / source.width) * source.height) / 2) * 2),
    };
  }

  if (lockedEdge === 'height' && nextHeight && nextHeight > 0) {
    return {
      width: Math.max(2, Math.round(((nextHeight / source.height) * source.width) / 2) * 2),
      height: nextHeight,
    };
  }

  return null;
}

export function applyUpscaleResolution(
  resolution: ResolvedResolution | null,
  upscaleMode: UpscaleMode
): ResolvedResolution | null {
  if (!resolution) {
    return null;
  }

  const factor = getUpscaleFactor(upscaleMode);
  return {
    width: resolution.width * factor,
    height: resolution.height * factor,
  };
}

function buildResolutionOptionLabel(
  baseLabel: string,
  source: ResolutionDimensions | null,
  settings: ResolutionSettings,
  outputKind: 'video' | 'images'
): string {
  const resolved = resolveResolution(settings, source ?? {}, {
    enforceEven: outputKind === 'video',
  });

  if (!resolved) {
    return baseLabel;
  }

  return `${baseLabel} (${resolved.width} x ${resolved.height})`;
}
