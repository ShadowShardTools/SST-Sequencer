declare module 'pixel-scale-epx' {
  export function upscaleRgba2x(
    rgba: Uint8Array,
    width: number,
    height: number,
    use8BitColors?: boolean
  ): Uint8Array;

  export function upscaleRgba3x(
    rgba: Uint8Array,
    width: number,
    height: number,
    use8BitColors?: boolean
  ): Uint8Array;

  export function upscaleRgba4x(
    rgba: Uint8Array,
    width: number,
    height: number,
    use8BitColors?: boolean
  ): Uint8Array;

  export function upscaleRgba6x(
    rgba: Uint8Array,
    width: number,
    height: number,
    use8BitColors?: boolean
  ): Uint8Array;

  export function upscaleRgba8x(
    rgba: Uint8Array,
    width: number,
    height: number,
    use8BitColors?: boolean
  ): Uint8Array;

  export function expandAndAntiAliasRgba2x(
    rgba: Uint8Array,
    width: number,
    height: number,
    use8BitColors?: boolean
  ): Uint8Array;

  export function scaleByHalf(
    bufferOut: Uint8Array,
    bufferExpanded: Uint8Array,
    width: number,
    height: number
  ): Uint8Array;
}
