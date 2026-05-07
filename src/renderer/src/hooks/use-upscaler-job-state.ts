import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  createDefaultUpscalerConfig,
  getUpscalerTypeFromConfig,
  normalizeUpscaleModeForUpscaler,
  type UpscaleMode,
  type UpscalerConfig,
  type UpscalerType,
} from '../../../shared/upscalers/registry';

type UpscaleJobState = {
  upscalerConfig: UpscalerConfig;
  upscaleMode: UpscaleMode;
};

export function useUpscalerJobState<T extends UpscaleJobState>(
  initialState: T,
  options: {
    supportedUpscalers: readonly UpscalerType[];
    fallbackUpscaler: UpscalerType;
  }
): [T, Dispatch<SetStateAction<T>>] {
  const [job, setJob] = useState<T>(initialState);

  useEffect(() => {
    setJob((current) => {
      const currentUpscaler = getUpscalerTypeFromConfig(current.upscalerConfig);
      const upscaler = options.supportedUpscalers.includes(currentUpscaler)
        ? currentUpscaler
        : options.fallbackUpscaler;

      return {
        ...current,
        upscalerConfig:
          upscaler === currentUpscaler
            ? current.upscalerConfig
            : createDefaultUpscalerConfig(upscaler),
        upscaleMode: normalizeUpscaleModeForUpscaler(upscaler, current.upscaleMode),
      };
    });
  }, [options.fallbackUpscaler, options.supportedUpscalers]);

  return [job, setJob];
}
