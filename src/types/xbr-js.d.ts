declare module 'xbr-js/dist/xBRjs.esm.js' {
  export function xbr2x(
    pixels: Uint32Array,
    width: number,
    height: number,
    options?: {
      blendColors?: boolean;
      scaleAlpha?: boolean;
    }
  ): Uint32Array;

  export function xbr3x(
    pixels: Uint32Array,
    width: number,
    height: number,
    options?: {
      blendColors?: boolean;
      scaleAlpha?: boolean;
    }
  ): Uint32Array;

  export function xbr4x(
    pixels: Uint32Array,
    width: number,
    height: number,
    options?: {
      blendColors?: boolean;
      scaleAlpha?: boolean;
    }
  ): Uint32Array;
}
