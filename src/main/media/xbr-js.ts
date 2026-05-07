import { mkdir } from 'node:fs/promises';
import { xbr2x, xbr3x, xbr4x } from 'xbr-js/dist/xBRjs.esm.js';
import {
  replaceLowAlphaRgb,
  upscalePngDirectoryWithRgbaTransform,
  type RgbaFrame,
} from './png-rgba';
import type { JobEmitter } from './types';

const XBR_JS_SCALES = [2, 3, 4, 6, 8] as const;

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
  const steps = scale === 6 ? [2, 3] : scale === 8 ? [2, 4] : [scale];

  return steps.reduce(
    (currentFrame, currentScale) => upscaleFrameWithXbrJsStep(currentFrame, currentScale, preserveAlpha),
    preparedFrame
  );
}

function upscaleFrameWithXbrJsStep(
  frame: RgbaFrame,
  scale: number,
  preserveAlpha: boolean
): RgbaFrame {
  const inputPixels = new Uint32Array(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength / 4);
  const outputPixels =
    scale === 2
      ? xbr2x(inputPixels, frame.width, frame.height, {
          scaleAlpha: preserveAlpha,
        })
      : scale === 3
        ? xbr3x(inputPixels, frame.width, frame.height, {
            scaleAlpha: preserveAlpha,
          })
        : xbr4x(inputPixels, frame.width, frame.height, {
            scaleAlpha: preserveAlpha,
          });

  return {
    width: frame.width * scale,
    height: frame.height * scale,
    data: new Uint8Array(outputPixels.buffer, outputPixels.byteOffset, outputPixels.byteLength),
  };
}
