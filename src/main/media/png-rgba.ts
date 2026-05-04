import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { PNG } from 'pngjs';
import { getImageFilesFromFolder } from './discovery';

export type RgbaFrame = {
  width: number;
  height: number;
  data: Uint8Array;
};

export async function upscalePngDirectoryWithRgbaTransform(options: {
  inputDir: string;
  outputDir: string;
  transform: (frame: RgbaFrame) => RgbaFrame;
}): Promise<void> {
  await mkdir(options.outputDir, { recursive: true });

  const inputImagePaths = await getImageFilesFromFolder(options.inputDir);
  for (const inputPath of inputImagePaths) {
    const inputFrame = await readPngRgbaFrame(inputPath);
    const outputFrame = options.transform(inputFrame);
    const outputPath = join(options.outputDir, `${basename(inputPath, extname(inputPath))}.png`);
    await writePngRgbaFrame(outputPath, outputFrame);
  }
}

export async function readPngRgbaFrame(filePath: string): Promise<RgbaFrame> {
  const fileBuffer = await readFile(filePath);
  const image = PNG.sync.read(fileBuffer);

  return {
    width: image.width,
    height: image.height,
    data: new Uint8Array(image.data),
  };
}

export async function writePngRgbaFrame(filePath: string, frame: RgbaFrame): Promise<void> {
  const image = new PNG({
    width: frame.width,
    height: frame.height,
  });
  image.data = Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
  const imageBuffer = PNG.sync.write(image);

  await writeFile(filePath, imageBuffer);
}

export function replaceLowAlphaRgb(frame: RgbaFrame, maxAlpha = 0): RgbaFrame {
  const output = new Uint8Array(frame.data);
  const visited = new Uint8Array(frame.width * frame.height);
  const queue: number[] = [];

  for (let index = 0; index < frame.width * frame.height; index += 1) {
    if (output[index * 4 + 3] > maxAlpha) {
      visited[index] = 1;
      queue.push(index);
    }
  }

  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    const x = index % frame.width;
    const y = Math.floor(index / frame.width);
    const offset = index * 4;
    const red = output[offset];
    const green = output[offset + 1];
    const blue = output[offset + 2];
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];

    for (const [nextX, nextY] of neighbors) {
      if (nextX < 0 || nextY < 0 || nextX >= frame.width || nextY >= frame.height) {
        continue;
      }

      const nextIndex = nextY * frame.width + nextX;
      if (visited[nextIndex]) {
        continue;
      }

      const nextOffset = nextIndex * 4;
      if (output[nextOffset + 3] > maxAlpha) {
        continue;
      }

      output[nextOffset] = red;
      output[nextOffset + 1] = green;
      output[nextOffset + 2] = blue;
      visited[nextIndex] = 1;
      queue.push(nextIndex);
    }
  }

  return {
    width: frame.width,
    height: frame.height,
    data: output,
  };
}

export function scaleAlphaNearest(frame: RgbaFrame, scale: number): Uint8Array {
  const outputWidth = frame.width * scale;
  const outputHeight = frame.height * scale;
  const output = new Uint8Array(outputWidth * outputHeight);

  for (let y = 0; y < outputHeight; y += 1) {
    const sourceY = Math.floor(y / scale);
    for (let x = 0; x < outputWidth; x += 1) {
      const sourceX = Math.floor(x / scale);
      const sourceOffset = (sourceY * frame.width + sourceX) * 4 + 3;
      output[y * outputWidth + x] = frame.data[sourceOffset];
    }
  }

  return output;
}

export function mergeRgbWithAlpha(
  rgb: Uint8Array,
  alpha: Uint8Array,
  width: number,
  height: number
): RgbaFrame {
  const output = new Uint8Array(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    const rgbaOffset = index * 4;
    output[rgbaOffset] = rgb[rgbaOffset];
    output[rgbaOffset + 1] = rgb[rgbaOffset + 1];
    output[rgbaOffset + 2] = rgb[rgbaOffset + 2];
    output[rgbaOffset + 3] = alpha[index] ?? 0;
  }

  return {
    width,
    height,
    data: output,
  };
}
