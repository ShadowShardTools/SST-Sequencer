import { getAlphaModeLabel, type AlphaMode } from '../../../shared/upscalers/registry';

export function getAlphaModeNote(alphaMode: AlphaMode, hasAlpha: boolean | undefined): string {
  if (hasAlpha === undefined) {
    if (alphaMode === 'auto') {
      return 'Auto-detect inspects the first source frame in each batch item and chooses straight or premultiplied alpha before the upscale runs.';
    }

    return `${getAlphaModeLabel(alphaMode)} is forced for transparent batch items before upscaling. Use this when you know the source alpha is consistent across the batch.`;
  }

  if (!hasAlpha) {
    return 'No alpha was detected on the current source. This setting only affects transparent inputs.';
  }

  if (alphaMode === 'auto') {
    return 'Auto-detect inspects the first source frame and chooses straight or premultiplied alpha before the upscale runs.';
  }

  return `${getAlphaModeLabel(alphaMode)} is forced for the alpha split before upscaling. Use this if auto-detect picks the wrong mode.`;
}
