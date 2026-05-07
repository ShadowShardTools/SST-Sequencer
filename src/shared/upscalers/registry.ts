export type SelectOption<TValue extends string> = {
  value: TValue;
  label: string;
};

export type UpscaleMode = 'off' | '2x' | '3x' | '4x' | '6x' | '8x';
export type UpscalerType =
  | 'realesrgan'
  | 'realcugan'
  | 'waifu2x'
  | 'realsr'
  | 'swinir'
  | 'dat'
  | 'anime4kcpp'
  | 'xbr-js'
  | 'pixel-scale-epx'
  | 'nearest';
export type AlphaMode = 'auto' | 'straight' | 'premultiplied';
export type RealEsrganModel =
  | 'realesrgan-x4plus'
  | 'realesrgan-x4plus-anime'
  | 'realesr-animevideov3';
export type RealcuganVariant = 'no-denoise' | 'denoise' | 'conservative';
export type Waifu2xModel = 'cunet' | 'anime-style-art-rgb' | 'photo';
export type Waifu2xNoiseLevel = 'off' | '0' | '1' | '2' | '3';
export type Anime4kcppModel =
  | 'acnet-gan'
  | 'acnet-hdn0'
  | 'acnet-hdn1'
  | 'acnet-hdn2'
  | 'acnet-hdn3'
  | 'arnet-hdn';
export type UpscalerBackendId =
  | 'realesrgan'
  | 'realcugan'
  | 'waifu2x'
  | 'realsr'
  | 'swinir'
  | 'dat'
  | 'anime4kcpp'
  | 'xbr-js'
  | 'pixel-scale-epx'
  | 'nearest';
export type UpscalerConfig =
  | {
      kind: 'realesrgan';
      model: RealEsrganModel;
    }
  | {
      kind: 'realcugan';
      variant: RealcuganVariant;
    }
  | {
      kind: 'waifu2x';
      model: Waifu2xModel;
      noise: Waifu2xNoiseLevel;
    }
  | {
      kind: 'anime4kcpp';
      model: Anime4kcppModel;
    }
  | {
      kind: 'nearest' | 'realsr' | 'swinir' | 'dat' | 'xbr-js' | 'pixel-scale-epx';
    };

export type UpscalerConfigFieldKey = 'model' | 'variant' | 'noise';
export type UpscalerConfigField = {
  key: UpscalerConfigFieldKey;
  label: string;
  note: string;
  options: ReadonlyArray<SelectOption<string>>;
};

type UpscalerDefinition = {
  type: UpscalerType;
  backendId: UpscalerBackendId;
  label: string;
  supportedPlatforms?: readonly (NodeJS.Platform | string)[];
  supportedScales: readonly Exclude<UpscaleMode, 'off'>[];
  defaultConfig: UpscalerConfig;
  configFields: readonly UpscalerConfigField[];
};

export const UPSCALE_OPTIONS: ReadonlyArray<SelectOption<UpscaleMode>> = [
  { value: 'off', label: 'Off' },
  { value: '2x', label: '2x' },
  { value: '3x', label: '3x' },
  { value: '4x', label: '4x' },
  { value: '6x', label: '6x' },
  { value: '8x', label: '8x' },
];

export const ALPHA_MODE_OPTIONS: ReadonlyArray<SelectOption<AlphaMode>> = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'straight', label: 'Force straight alpha' },
  { value: 'premultiplied', label: 'Force premultiplied alpha' },
];

export const REAL_ESRGAN_MODEL_OPTIONS: ReadonlyArray<SelectOption<RealEsrganModel>> = [
  { value: 'realesrgan-x4plus', label: 'RealESRGAN x4plus' },
  { value: 'realesrgan-x4plus-anime', label: 'RealESRGAN x4plus Anime' },
  { value: 'realesr-animevideov3', label: 'RealESR AnimeVideo v3' },
];

export const REALCUGAN_VARIANT_OPTIONS: ReadonlyArray<SelectOption<RealcuganVariant>> = [
  { value: 'no-denoise', label: 'No denoise' },
  { value: 'denoise', label: 'Denoise' },
  { value: 'conservative', label: 'Conservative' },
];

export const WAIFU2X_MODEL_OPTIONS: ReadonlyArray<SelectOption<Waifu2xModel>> = [
  { value: 'cunet', label: 'CUNet' },
  { value: 'anime-style-art-rgb', label: 'Anime style art' },
  { value: 'photo', label: 'Photo' },
];

export const WAIFU2X_NOISE_LEVEL_OPTIONS: ReadonlyArray<SelectOption<Waifu2xNoiseLevel>> = [
  { value: 'off', label: 'Off' },
  { value: '0', label: 'Noise 0' },
  { value: '1', label: 'Noise 1' },
  { value: '2', label: 'Noise 2' },
  { value: '3', label: 'Noise 3' },
];

export const ANIME4KCPP_MODEL_OPTIONS: ReadonlyArray<SelectOption<Anime4kcppModel>> = [
  { value: 'arnet-hdn', label: 'ARNet HDN' },
  { value: 'acnet-hdn0', label: 'ACNet HDN0' },
  { value: 'acnet-hdn1', label: 'ACNet HDN1' },
  { value: 'acnet-hdn2', label: 'ACNet HDN2' },
  { value: 'acnet-hdn3', label: 'ACNet HDN3' },
  { value: 'acnet-gan', label: 'ACNet GAN' },
];

const UPSCALER_DEFINITIONS: readonly UpscalerDefinition[] = [
  {
    type: 'realesrgan',
    backendId: 'realesrgan',
    label: 'General / stylized - Real-ESRGAN',
    supportedScales: ['2x', '3x', '4x', '6x', '8x'],
    defaultConfig: {
      kind: 'realesrgan',
      model: 'realesrgan-x4plus',
    },
    configFields: [
      {
        key: 'model',
        label: 'Model',
        note: 'Choose the Real-ESRGAN model family for this source.',
        options: REAL_ESRGAN_MODEL_OPTIONS,
      },
    ],
  },
  {
    type: 'realcugan',
    backendId: 'realcugan',
    label: 'Anime / stylized - Real-CUGAN',
    supportedScales: ['2x', '3x', '4x', '6x', '8x'],
    defaultConfig: {
      kind: 'realcugan',
      variant: 'no-denoise',
    },
    configFields: [
      {
        key: 'variant',
        label: 'Variant',
        note: 'Choose how strongly Real-CUGAN denoises before upscaling.',
        options: REALCUGAN_VARIANT_OPTIONS,
      },
    ],
  },
  {
    type: 'waifu2x',
    backendId: 'waifu2x',
    label: 'Anime / stylized - Waifu2x',
    supportedScales: ['2x', '3x', '4x', '6x', '8x'],
    defaultConfig: {
      kind: 'waifu2x',
      model: 'cunet',
      noise: 'off',
    },
    configFields: [
      {
        key: 'model',
        label: 'Model',
        note: 'Choose the Waifu2x training domain.',
        options: WAIFU2X_MODEL_OPTIONS,
      },
      {
        key: 'noise',
        label: 'Denoise',
        note: 'Control how strongly Waifu2x cleans source noise before scaling.',
        options: WAIFU2X_NOISE_LEVEL_OPTIONS,
      },
    ],
  },
  {
    type: 'realsr',
    backendId: 'realsr',
    label: 'General photo - RealSR',
    supportedScales: ['2x', '3x', '4x', '6x', '8x'],
    defaultConfig: {
      kind: 'realsr',
    },
    configFields: [],
  },
  {
    type: 'swinir',
    backendId: 'swinir',
    label: 'General clean - SwinIR',
    supportedScales: ['2x', '3x', '4x', '6x', '8x'],
    defaultConfig: {
      kind: 'swinir',
    },
    configFields: [],
  },
  {
    type: 'dat',
    backendId: 'dat',
    label: 'General detailed - DAT',
    supportedScales: ['2x', '3x', '4x', '6x', '8x'],
    defaultConfig: {
      kind: 'dat',
    },
    configFields: [],
  },
  {
    type: 'anime4kcpp',
    backendId: 'anime4kcpp',
    label: 'Anime / stylized - Anime4KCPP',
    supportedPlatforms: ['win32'],
    supportedScales: ['2x', '3x', '4x', '6x', '8x'],
    defaultConfig: {
      kind: 'anime4kcpp',
      model: 'arnet-hdn',
    },
    configFields: [
      {
        key: 'model',
        label: 'Model',
        note: 'Choose the Anime4KCPP v3 CNN model.',
        options: ANIME4KCPP_MODEL_OPTIONS,
      },
    ],
  },
  {
    type: 'xbr-js',
    backendId: 'xbr-js',
    label: 'Pixel art only - xBR.js',
    supportedScales: ['2x', '3x', '4x', '6x', '8x'],
    defaultConfig: {
      kind: 'xbr-js',
    },
    configFields: [],
  },
  {
    type: 'pixel-scale-epx',
    backendId: 'pixel-scale-epx',
    label: 'Pixel art only - EPX / Scale2x',
    supportedScales: ['2x', '3x', '4x', '6x', '8x'],
    defaultConfig: {
      kind: 'pixel-scale-epx',
    },
    configFields: [],
  },
  {
    type: 'nearest',
    backendId: 'nearest',
    label: 'Pixel art - Nearest neighbor',
    supportedScales: ['2x', '3x', '4x', '6x', '8x'],
    defaultConfig: {
      kind: 'nearest',
    },
    configFields: [],
  },
];

const UPSCALER_OPTIONS_BY_TYPE = Object.fromEntries(
  UPSCALER_DEFINITIONS.map((definition) => [definition.type, definition])
) as Record<UpscalerType, UpscalerDefinition>;

export const UPSCALER_OPTIONS: ReadonlyArray<SelectOption<UpscalerType>> = UPSCALER_DEFINITIONS.map(
  (definition) => ({
    value: definition.type,
    label: definition.label,
  })
);

export function getUpscalerDefinitions(): ReadonlyArray<UpscalerDefinition> {
  return UPSCALER_DEFINITIONS;
}

export function getUpscalerDefinition(upscaler: UpscalerType): UpscalerDefinition {
  return UPSCALER_OPTIONS_BY_TYPE[upscaler];
}

export function getSupportedUpscalerOptions(
  platform: NodeJS.Platform | string
): ReadonlyArray<SelectOption<UpscalerType>> {
  return UPSCALER_OPTIONS.filter((option) => isUpscalerSupportedOnPlatform(option.value, platform));
}

export function getSupportedUpscalerValues(
  platform: NodeJS.Platform | string
): ReadonlyArray<UpscalerType> {
  return getSupportedUpscalerOptions(platform).map((option) => option.value);
}

export function getDefaultUpscalerForPlatform(platform: NodeJS.Platform | string): UpscalerType {
  return getSupportedUpscalerValues(platform)[0] ?? 'nearest';
}

export function createDefaultUpscalerConfig(kind: UpscalerType): UpscalerConfig {
  return { ...getUpscalerDefinition(kind).defaultConfig };
}

export function getUpscalerTypeFromConfig(config: UpscalerConfig): UpscalerType {
  return config.kind;
}

export function getUpscalerBackendId(configOrType: UpscalerConfig | UpscalerType): UpscalerBackendId {
  const upscaler = typeof configOrType === 'string' ? configOrType : configOrType.kind;
  return getUpscalerDefinition(upscaler).backendId;
}

export function getUpscalerConfigFields(
  configOrType: UpscalerConfig | UpscalerType
): ReadonlyArray<UpscalerConfigField> {
  const upscaler = typeof configOrType === 'string' ? configOrType : configOrType.kind;
  return getUpscalerDefinition(upscaler).configFields;
}

export function isUpscalerSupportedOnPlatform(
  upscaler: UpscalerType,
  platform: NodeJS.Platform | string
): boolean {
  const supportedPlatforms = getUpscalerDefinition(upscaler).supportedPlatforms;
  return !supportedPlatforms || supportedPlatforms.includes(platform);
}

export function getUpscaleFactor(mode: UpscaleMode): number {
  switch (mode) {
    case '2x':
      return 2;
    case '3x':
      return 3;
    case '4x':
      return 4;
    case '6x':
      return 6;
    case '8x':
      return 8;
    case 'off':
    default:
      return 1;
  }
}

export function getSupportedUpscaleModesForUpscaler(
  upscaler: UpscalerType,
  includeOff = true
): ReadonlyArray<UpscaleMode> {
  const modes = getUpscalerDefinition(upscaler).supportedScales;
  return includeOff ? (['off', ...modes] as const) : modes;
}

export function getSupportedUpscaleOptionsForUpscaler(
  upscaler: UpscalerType
): ReadonlyArray<SelectOption<UpscaleMode>> {
  const supportedModes = new Set(getSupportedUpscaleModesForUpscaler(upscaler));
  return UPSCALE_OPTIONS.filter((option) => supportedModes.has(option.value));
}

export function isUpscaleModeSupportedByUpscaler(
  upscaler: UpscalerType,
  mode: UpscaleMode
): boolean {
  return getSupportedUpscaleModesForUpscaler(upscaler).includes(mode);
}

export function normalizeUpscaleModeForUpscaler(
  upscaler: UpscalerType,
  mode: UpscaleMode
): UpscaleMode {
  if (isUpscaleModeSupportedByUpscaler(upscaler, mode)) {
    return mode;
  }

  if (mode === 'off') {
    return 'off';
  }

  const supportedModes = getSupportedUpscaleModesForUpscaler(upscaler, false);
  const requestedFactor = getUpscaleFactor(mode);
  let bestMode = supportedModes[0] ?? '2x';
  let bestDistance = Math.abs(getUpscaleFactor(bestMode) - requestedFactor);

  for (const supportedMode of supportedModes.slice(1)) {
    const distance = Math.abs(getUpscaleFactor(supportedMode) - requestedFactor);
    if (
      distance < bestDistance ||
      (distance === bestDistance && getUpscaleFactor(supportedMode) < getUpscaleFactor(bestMode))
    ) {
      bestMode = supportedMode;
      bestDistance = distance;
    }
  }

  return bestMode;
}

export function getUpscalerSupportedScaleSummary(upscaler: UpscalerType): string {
  return getSupportedUpscaleModesForUpscaler(upscaler, false).join(', ');
}

export function getUpscalerLabel(value: UpscalerType): string {
  return getUpscalerDefinition(value).label.replace(/^[^-]+-\s*/, '');
}

export function getUpscalerNote(upscaler: UpscalerType, mode: UpscaleMode): string {
  if (mode === 'off') {
    return 'Disabled. The export uses the selected base resolution directly.';
  }

  const isComposedLargeScale =
    (mode === '6x' || mode === '8x') &&
    upscaler !== 'nearest' &&
    upscaler !== 'xbr-js' &&
    upscaler !== 'pixel-scale-epx';

  if (upscaler === 'nearest') {
    return `Pixel-art safe. ${getUpscalerLabel(upscaler)} will scale from the selected base resolution by ${mode} and preserve hard edges and transparency.`;
  }

  if (upscaler === 'xbr-js') {
    return `${getUpscalerLabel(upscaler)} will upscale from the selected base resolution by ${mode}. Use it for sprites and hard-edged pixel art only. It smooths stair-step diagonals, but it is not meant for painted, antialiased, or photo-like images.`;
  }

  if (upscaler === 'pixel-scale-epx') {
    return `${getUpscalerLabel(upscaler)} will upscale from the selected base resolution by ${mode}. Use it for sprites and hard-edged pixel art only. It keeps pixel clusters crisp, but it is not meant for painted, antialiased, or photo-like images.`;
  }

  if (upscaler === 'realesrgan') {
    const scaleNote =
      mode === '4x'
        ? 'This backend is run at its native 4x path.'
        : 'This backend is run at native 4x first, then resized to the selected factor to avoid block artifacts from lower direct scales.';
    return `${getUpscalerLabel(upscaler)} will upscale from the selected base resolution by ${mode}. ${scaleNote} Choose the model in the sidebar to switch between the default x4plus model, the smaller anime image model, or AnimeVideo v3. Transparent sources keep a separately scaled alpha mask.`;
  }

  if (upscaler === 'realcugan') {
    return `${getUpscalerLabel(upscaler)} will upscale from the selected base resolution by ${mode}. Use the variant dropdown in the sidebar to switch between no-denoise, denoise, and conservative behavior. Transparent sources keep a separately scaled alpha mask.`;
  }

  if (upscaler === 'waifu2x') {
    const scaleNote =
      mode === '3x'
        ? 'Waifu2x does not natively support 3x, so this pass runs 4x first and downsamples to 3x.'
        : isComposedLargeScale
          ? `Waifu2x does not natively support ${mode}, so this pass is composed from multiple native upscale passes.`
          : 'Choose the model and denoise level in the sidebar for this source.';
    return `${getUpscalerLabel(upscaler)} will upscale from the selected base resolution by ${mode}. ${scaleNote} Transparent sources keep a separately scaled alpha mask.`;
  }

  if (upscaler === 'realsr') {
    const scaleNote =
      mode === '4x'
        ? 'This pass uses the DF2K_JPEG model for native 4x upscale.'
        : isComposedLargeScale
          ? `RealSR does not natively support ${mode}, so this pass is composed from multiple native upscale passes.`
          : 'RealSR only supports 4x natively, so this pass runs 4x first and downsamples to the selected factor.';
    return `${getUpscalerLabel(upscaler)} will upscale from the selected base resolution by ${mode}. ${scaleNote} Transparent sources keep a separately scaled alpha mask.`;
  }

  if (upscaler === 'swinir') {
    return `${getUpscalerLabel(upscaler)} will upscale from the selected base resolution by ${mode}. ${isComposedLargeScale ? 'Large factors are composed from multiple native passes. ' : ''}This pass uses the official classical DF2K model and requires Python with torch, timm, numpy, and opencv-python installed. Transparent sources keep a separately scaled alpha mask.`;
  }

  if (upscaler === 'dat') {
    return `${getUpscalerLabel(upscaler)} will upscale from the selected base resolution by ${mode}. ${isComposedLargeScale ? 'Large factors are composed from multiple native passes. ' : ''}This pass uses the official ICCV 2023 classical SR model and requires Python with torch, timm, einops, numpy, and opencv-python installed. Transparent sources keep a separately scaled alpha mask.`;
  }

  if (upscaler === 'anime4kcpp') {
    return `${getUpscalerLabel(upscaler)} will upscale from the selected base resolution by ${mode}. ${isComposedLargeScale ? 'Large factors are composed from multiple native passes. ' : ''}Choose the Anime4KCPP model in the sidebar. The runtime picks the best available backend in this order: CUDA, OpenCL, then CPU. Transparent sources keep a separately scaled alpha mask.`;
  }

  return `${getUpscalerLabel(upscaler)} will upscale from the selected base resolution by ${mode}${isComposedLargeScale ? ' using multiple native passes' : ''} and preserve alpha when the output format supports transparency.`;
}

export function isValidUpscaleMode(value: string): value is UpscaleMode {
  return UPSCALE_OPTIONS.some((option) => option.value === value);
}

export function isValidUpscalerType(value: string): value is UpscalerType {
  return UPSCALER_DEFINITIONS.some((definition) => definition.type === value);
}

export function isValidAlphaMode(value: string): value is AlphaMode {
  return ALPHA_MODE_OPTIONS.some((option) => option.value === value);
}

export function isValidRealEsrganModel(value: string): value is RealEsrganModel {
  return REAL_ESRGAN_MODEL_OPTIONS.some((option) => option.value === value);
}

export function isValidRealcuganVariant(value: string): value is RealcuganVariant {
  return REALCUGAN_VARIANT_OPTIONS.some((option) => option.value === value);
}

export function isValidWaifu2xModel(value: string): value is Waifu2xModel {
  return WAIFU2X_MODEL_OPTIONS.some((option) => option.value === value);
}

export function isValidWaifu2xNoiseLevel(value: string): value is Waifu2xNoiseLevel {
  return WAIFU2X_NOISE_LEVEL_OPTIONS.some((option) => option.value === value);
}

export function isValidAnime4kcppModel(value: string): value is Anime4kcppModel {
  return ANIME4KCPP_MODEL_OPTIONS.some((option) => option.value === value);
}

export function getAlphaModeLabel(value: AlphaMode): string {
  switch (value) {
    case 'straight':
      return 'Straight alpha';
    case 'premultiplied':
      return 'Premultiplied alpha';
    case 'auto':
    default:
      return 'Auto-detect';
  }
}

export function getUpscalerConfigValidationError(config: UpscalerConfig): string | null {
  for (const field of getUpscalerConfigFields(config)) {
    const fieldValue = (config as Record<string, string>)[field.key];
    if (!field.options.some((option) => option.value === fieldValue)) {
      return `${getUpscalerLabel(config.kind)} ${field.label.toLowerCase()} is invalid.`;
    }
  }

  return null;
}

export function isValidUpscalerConfig(config: UpscalerConfig): boolean {
  return getUpscalerConfigValidationError(config) === null;
}
