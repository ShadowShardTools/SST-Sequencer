import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, describe, expect, it } from 'vitest';
import { upscaleImageDirectory as upscaleWithPixelScaleEpx } from './pixel-scale-epx';
import { readPngRgbaFrame } from './png-rgba';
import { upscaleImageDirectory as upscaleWithXbrJs } from './xbr-js';

const createdDirs: string[] = [];

const noopEmitter = {
  started: () => undefined,
  log: () => undefined,
  progress: () => undefined,
  finished: () => undefined,
};

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('pixel-art upscalers', () => {
  it('upscales a PNG sequence with xBR.js', async () => {
    const { inputDir, outputDir } = await createFixtureDirs();
    await writePngFixture(join(inputDir, 'frame_000001.png'));

    await upscaleWithXbrJs({
      inputDir,
      outputDir,
      scale: 2,
      emitter: noopEmitter,
    });

    const outputFrame = await readPngRgbaFrame(join(outputDir, 'frame_000001.png'));
    expect(outputFrame.width).toBe(4);
    expect(outputFrame.height).toBe(4);
  });

  it('supports xBR.js 8x output', async () => {
    const { inputDir, outputDir } = await createFixtureDirs();
    await writePngFixture(join(inputDir, 'frame_000001.png'));

    await upscaleWithXbrJs({
      inputDir,
      outputDir,
      scale: 8,
      emitter: noopEmitter,
    });

    const outputFrame = await readPngRgbaFrame(join(outputDir, 'frame_000001.png'));
    expect(outputFrame.width).toBe(16);
    expect(outputFrame.height).toBe(16);
  });

  it('avoids visible white fringe pixels for transparent xBR.js sources', async () => {
    const { inputDir, outputDir } = await createFixtureDirs();
    await writeTransparentWhiteFixture(join(inputDir, 'frame_000001.png'));

    await upscaleWithXbrJs({
      inputDir,
      outputDir,
      scale: 2,
      preserveAlpha: true,
      emitter: noopEmitter,
    });

    const outputFrame = await readPngRgbaFrame(join(outputDir, 'frame_000001.png'));
    let foundVisibleWhitePixel = false;

    for (let index = 0; index < outputFrame.data.length; index += 4) {
      const red = outputFrame.data[index];
      const green = outputFrame.data[index + 1];
      const blue = outputFrame.data[index + 2];
      const alpha = outputFrame.data[index + 3];

      if (alpha > 0 && red === 255 && green === 255 && blue === 255) {
        foundVisibleWhitePixel = true;
        break;
      }
    }

    expect(foundVisibleWhitePixel).toBe(false);
  });

  it('upscales a PNG sequence with pixel-scale-epx', async () => {
    const { inputDir, outputDir } = await createFixtureDirs();
    await writePngFixture(join(inputDir, 'frame_000001.png'));

    await upscaleWithPixelScaleEpx({
      inputDir,
      outputDir,
      scale: 3,
      emitter: noopEmitter,
    });

    const outputFrame = await readPngRgbaFrame(join(outputDir, 'frame_000001.png'));
    expect(outputFrame.width).toBe(6);
    expect(outputFrame.height).toBe(6);
  });

  it('supports pixel-scale-epx 8x output', async () => {
    const { inputDir, outputDir } = await createFixtureDirs();
    await writePngFixture(join(inputDir, 'frame_000001.png'));

    await upscaleWithPixelScaleEpx({
      inputDir,
      outputDir,
      scale: 8,
      emitter: noopEmitter,
    });

    const outputFrame = await readPngRgbaFrame(join(outputDir, 'frame_000001.png'));
    expect(outputFrame.width).toBe(16);
    expect(outputFrame.height).toBe(16);
  });

  it('avoids visible white fringe pixels for transparent pixel-scale-epx sources', async () => {
    const { inputDir, outputDir } = await createFixtureDirs();
    await writeTransparentWhiteFixture(join(inputDir, 'frame_000001.png'));

    await upscaleWithPixelScaleEpx({
      inputDir,
      outputDir,
      scale: 2,
      preserveAlpha: true,
      emitter: noopEmitter,
    });

    const outputFrame = await readPngRgbaFrame(join(outputDir, 'frame_000001.png'));
    let foundVisibleWhitePixel = false;

    for (let index = 0; index < outputFrame.data.length; index += 4) {
      const red = outputFrame.data[index];
      const green = outputFrame.data[index + 1];
      const blue = outputFrame.data[index + 2];
      const alpha = outputFrame.data[index + 3];

      if (alpha > 0 && red === 255 && green === 255 && blue === 255) {
        foundVisibleWhitePixel = true;
        break;
      }
    }

    expect(foundVisibleWhitePixel).toBe(false);
  });

  it('supports anti-aliased EPX output at 3x', async () => {
    const { inputDir, outputDir } = await createFixtureDirs();
    await writePngFixture(join(inputDir, 'frame_000001.png'));

    await upscaleWithPixelScaleEpx({
      inputDir,
      outputDir,
      scale: 3,
      epxAntialias: true,
      emitter: noopEmitter,
    });

    const outputFrame = await readPngRgbaFrame(join(outputDir, 'frame_000001.png'));
    expect(outputFrame.width).toBe(6);
    expect(outputFrame.height).toBe(6);
  });
});

async function createFixtureDirs(): Promise<{ inputDir: string; outputDir: string }> {
  const rootDir = await mkdtemp(join(tmpdir(), 'sst-pixel-upscale-test-'));
  createdDirs.push(rootDir);

  const inputDir = join(rootDir, 'input');
  const outputDir = join(rootDir, 'output');
  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  return { inputDir, outputDir };
}

async function writePngFixture(filePath: string): Promise<void> {
  const png = new PNG({
    width: 2,
    height: 2,
  });
  png.data = Buffer.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]);
  const pngBuffer = PNG.sync.write(png);

  await writeFile(filePath, pngBuffer);
}

async function writeTransparentWhiteFixture(filePath: string): Promise<void> {
  const png = new PNG({
    width: 2,
    height: 2,
  });
  png.data = Buffer.from([
    160,
    80,
    40,
    255,
    255,
    255,
    255,
    0,
    255,
    255,
    255,
    0,
    255,
    255,
    255,
    0,
  ]);

  await writeFile(filePath, PNG.sync.write(png));
}
