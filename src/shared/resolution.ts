export type ResolutionMode =
  | 'source'
  | 'half'
  | 'quarter'
  | 'eighth'
  | 'custom';

export type ResolutionSettings = {
  resolutionMode: ResolutionMode;
  customWidth?: number;
  customHeight?: number;
};

export type ResolutionDimensions = {
  width?: number;
  height?: number;
};

export type ResolvedResolution = {
  width: number;
  height: number;
};

export const RESOLUTION_LIMITS = {
  dimension: {
    min: 2,
    max: 8192,
    step: 2,
  },
} as const;

export function isValidResolutionDimension(value: number | undefined): boolean {
  if (typeof value !== 'number') {
    return false;
  }

  return (
    Number.isInteger(value) &&
    value >= RESOLUTION_LIMITS.dimension.min &&
    value <= RESOLUTION_LIMITS.dimension.max
  );
}

export function isValidResolutionSettings(settings: ResolutionSettings): boolean {
  if (settings.resolutionMode !== 'custom') {
    return true;
  }

  return (
    isValidResolutionDimension(settings.customWidth) &&
    isValidResolutionDimension(settings.customHeight)
  );
}

export function resolveResolution(
  settings: ResolutionSettings,
  source: ResolutionDimensions,
  options: {
    enforceEven?: boolean;
  } = {}
): ResolvedResolution | null {
  const { width: sourceWidth, height: sourceHeight } = source;

  switch (settings.resolutionMode) {
    case 'source':
      if (
        typeof sourceWidth !== 'number' ||
        typeof sourceHeight !== 'number' ||
        sourceWidth <= 0 ||
        sourceHeight <= 0
      ) {
        return null;
      }

      return finalizeResolution(sourceWidth, sourceHeight, options.enforceEven);
    case 'half':
      if (
        typeof sourceWidth !== 'number' ||
        typeof sourceHeight !== 'number' ||
        sourceWidth <= 0 ||
        sourceHeight <= 0
      ) {
        return null;
      }

      return finalizeResolution(sourceWidth / 2, sourceHeight / 2, options.enforceEven);
    case 'quarter':
      if (
        typeof sourceWidth !== 'number' ||
        typeof sourceHeight !== 'number' ||
        sourceWidth <= 0 ||
        sourceHeight <= 0
      ) {
        return null;
      }

      return finalizeResolution(sourceWidth / 4, sourceHeight / 4, options.enforceEven);
    case 'eighth':
      if (
        typeof sourceWidth !== 'number' ||
        typeof sourceHeight !== 'number' ||
        sourceWidth <= 0 ||
        sourceHeight <= 0
      ) {
        return null;
      }

      return finalizeResolution(sourceWidth / 8, sourceHeight / 8, options.enforceEven);
    case 'custom': {
      const { customWidth, customHeight } = settings;
      if (
        typeof customWidth !== 'number' ||
        typeof customHeight !== 'number' ||
        !isValidResolutionDimension(customWidth) ||
        !isValidResolutionDimension(customHeight)
      ) {
        return null;
      }

      return finalizeResolution(customWidth, customHeight, options.enforceEven);
    }
    default:
      return null;
  }
}

function finalizeResolution(
  width: number,
  height: number,
  enforceEven = false
): ResolvedResolution {
  const boundedScale = Math.min(
    1,
    RESOLUTION_LIMITS.dimension.max / width,
    RESOLUTION_LIMITS.dimension.max / height
  );

  const boundedWidth = width * boundedScale;
  const boundedHeight = height * boundedScale;

  return {
    width: normalizeDimension(boundedWidth, enforceEven),
    height: normalizeDimension(boundedHeight, enforceEven),
  };
}

function normalizeDimension(value: number, enforceEven: boolean): number {
  const rounded = Math.round(value);
  const clamped = Math.min(
    RESOLUTION_LIMITS.dimension.max,
    Math.max(RESOLUTION_LIMITS.dimension.min, rounded)
  );

  if (!enforceEven) {
    return clamped;
  }

  const evenValue = clamped % 2 === 0 ? clamped : clamped - 1;
  return Math.max(RESOLUTION_LIMITS.dimension.min, evenValue);
}
