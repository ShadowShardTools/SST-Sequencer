import { mkdir } from 'node:fs/promises';
import { xbr2x, xbr3x, xbr4x } from 'xbr-js/dist/xBRjs.esm.js';
import {
  replaceLowAlphaRgb,
  upscalePngDirectoryWithRgbaTransform,
  type RgbaFrame,
} from './png-rgba';
import type { JobEmitter } from './types';

const XBR_JS_SCALES = [2, 3, 4] as const;

export async function upscaleImageDirectory(options: {
  inputDir: string;
  outputDir: string;
  scale: number;
  preserveAlpha?: boolean;
  emitter: JobEmitter;
}): Promise<void> {
  if (!XBR_JS_SCALES.includes(options.scale as (typeof XBR_JS_SCALES)[number])) {
    throw new Error(`Unsupported xBR.js scale: ${options.scale}.`);
  }

  await mkdir(options.outputDir, { recursive: true });

  if (options.preserveAlpha) {
    await upscalePngDirectoryWithRgbaTransform({
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      transform: (frame) => upscaleFrameWithXbrJs(frame, options.scale, true),
    });
    return;
  }

  await upscalePngDirectoryWithRgbaTransform({
    inputDir: options.inputDir,
    outputDir: options.outputDir,
    transform: (frame) => upscaleFrameWithXbrJs(frame, options.scale, false),
  });
}

function upscaleFrameWithXbrJs(frame: RgbaFrame, scale: number, preserveAlpha: boolean): RgbaFrame {
  const preparedFrame = preserveAlpha ? replaceLowAlphaRgb(frame, 0) : frame;
  const inputPixels = new Uint32Array(
    preparedFrame.data.buffer,
    preparedFrame.data.byteOffset,
    preparedFrame.data.byteLength / 4
  );
  const outputPixels =
    scale === 2
      ? xbr2x(inputPixels, preparedFrame.width, preparedFrame.height, {
          scaleAlpha: preserveAlpha,
        })
      : scale === 3
        ? xbr3x(inputPixels, preparedFrame.width, preparedFrame.height, {
            scaleAlpha: preserveAlpha,
          })
        : xbr4x(inputPixels, preparedFrame.width, preparedFrame.height, {
            scaleAlpha: preserveAlpha,
          });

  return {
    width: preparedFrame.width * scale,
    height: preparedFrame.height * scale,
    data: new Uint8Array(outputPixels.buffer, outputPixels.byteOffset, outputPixels.byteLength),
  };
}
