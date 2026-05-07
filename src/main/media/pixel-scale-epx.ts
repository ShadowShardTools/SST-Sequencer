import { mkdir } from 'node:fs/promises';
import * as pixelScaleEpx from 'pixel-scale-epx';
import {
  mergeRgbWithAlpha,
  replaceLowAlphaRgb,
  scaleAlphaNearest,
  upscalePngDirectoryWithRgbaTransform,
  type RgbaFrame,
} from './png-rgba';
import type { JobEmitter } from './types';

const PIXEL_SCALE_EPX_SCALES = [2, 3, 4, 6, 8] as const;

export async function upscaleImageDirectory(options: {
  inputDir: string;
  outputDir: string;
  scale: number;
  epxAntialias?: boolean;
  preserveAlpha?: boolean;
  emitter: JobEmitter;
}): Promise<void> {
  if (!PIXEL_SCALE_EPX_SCALES.includes(options.scale as (typeof PIXEL_SCALE_EPX_SCALES)[number])) {
    throw new Error(`Unsupported pixel-scale-epx scale: ${options.scale}.`);
  }

  await mkdir(options.outputDir, { recursive: true });

  if (options.preserveAlpha) {
    await upscalePngDirectoryWithRgbaTransform({
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      transform: (frame) =>
        upscaleFrameWithPixelScaleEpx(frame, options.scale, true, options.epxAntialias ?? false),
    });
    return;
  }

  await upscalePngDirectoryWithRgbaTransform({
    inputDir: options.inputDir,
    outputDir: options.outputDir,
    transform: (frame) =>
      upscaleFrameWithPixelScaleEpx(frame, options.scale, false, options.epxAntialias ?? false),
  });
}

function upscaleFrameWithPixelScaleEpx(
  frame: RgbaFrame,
  scale: number,
  preserveAlpha: boolean,
  antialias: boolean
): RgbaFrame {
  const preparedFrame = preserveAlpha ? replaceLowAlphaRgb(frame, 32) : frame;
  const outputData = antialias
    ? upscaleFrameWithPixelScaleEpxAntialias(preparedFrame, scale)
    : scale === 2
      ? pixelScaleEpx.upscaleRgba2x(preparedFrame.data, preparedFrame.width, preparedFrame.height)
      : scale === 3
        ? pixelScaleEpx.upscaleRgba3x(
            preparedFrame.data,
            preparedFrame.width,
            preparedFrame.height
          )
        : scale === 4
          ? pixelScaleEpx.upscaleRgba4x(
              preparedFrame.data,
              preparedFrame.width,
              preparedFrame.height
            )
          : scale === 6
            ? pixelScaleEpx.upscaleRgba6x(
                preparedFrame.data,
                preparedFrame.width,
                preparedFrame.height
              )
            : pixelScaleEpx.upscaleRgba8x(
                preparedFrame.data,
                preparedFrame.width,
                preparedFrame.height
              );

  if (preserveAlpha) {
    const outputWidth = preparedFrame.width * scale;
    const outputHeight = preparedFrame.height * scale;
    return mergeRgbWithAlpha(
      new Uint8Array(outputData),
      scaleAlphaNearest(frame, scale),
      outputWidth,
      outputHeight
    );
  }

  return {
    width: preparedFrame.width * scale,
    height: preparedFrame.height * scale,
    data: new Uint8Array(outputData),
  };
}

function upscaleFrameWithPixelScaleEpxAntialias(frame: RgbaFrame, scale: number): Uint8Array {
  if (scale === 2) {
    return new Uint8Array(
      pixelScaleEpx.expandAndAntiAliasRgba2x(frame.data, frame.width, frame.height)
    );
  }

  if (scale === 6 || scale === 8) {
    const antialiasedInput = new Uint8Array(
      pixelScaleEpx.expandAndAntiAliasRgba2x(frame.data, frame.width, frame.height)
    );
    return new Uint8Array(
      scale === 6
        ? pixelScaleEpx.upscaleRgba3x(antialiasedInput, frame.width * 2, frame.height * 2)
        : pixelScaleEpx.upscaleRgba4x(antialiasedInput, frame.width * 2, frame.height * 2)
    );
  }

  const outputWidth = frame.width * scale;
  const outputHeight = frame.height * scale;
  const crispOutput =
    scale === 3
      ? pixelScaleEpx.upscaleRgba3x(frame.data, frame.width, frame.height)
      : pixelScaleEpx.upscaleRgba4x(frame.data, frame.width, frame.height);
  const expandedOutput =
    scale === 3
      ? pixelScaleEpx.upscaleRgba6x(frame.data, frame.width, frame.height)
      : pixelScaleEpx.upscaleRgba8x(frame.data, frame.width, frame.height);

  return new Uint8Array(
    pixelScaleEpx.scaleByHalf(
      new Uint8Array(crispOutput),
      new Uint8Array(expandedOutput),
      outputWidth,
      outputHeight
    )
  );
}
