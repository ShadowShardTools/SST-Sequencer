import { describe, expect, it } from 'vitest';
import { buildSequenceToVideoFilterSpec } from './ffmpeg';

describe('sequence-to-video filters', () => {
  it('applies resize inside the GIF palette pipeline', () => {
    const filterSpec = buildSequenceToVideoFilterSpec({
      fps: 24,
      speed: 1,
      quality: 100,
      format: 'gif-palette',
      resize: {
        width: 320,
        height: 180,
      },
    });

    expect(filterSpec.argument).toBe('-filter_complex');
    expect(filterSpec.value).toContain('fps=24');
    expect(filterSpec.value).toContain('scale=320:180:flags=lanczos');
    expect(filterSpec.value).toContain('palettegen=');
    expect(filterSpec.value).toContain('paletteuse=');
  });

  it('applies resize for APNG exports', () => {
    const filterSpec = buildSequenceToVideoFilterSpec({
      fps: 24,
      speed: 1,
      quality: 100,
      format: 'apng',
      resize: {
        width: 512,
        height: 512,
      },
    });

    expect(filterSpec.argument).toBe('-vf');
    expect(filterSpec.value).toContain('scale=512:512:flags=lanczos');
    expect(filterSpec.value).toContain('format=rgba');
  });

  it('applies resize and padding for standard video exports', () => {
    const filterSpec = buildSequenceToVideoFilterSpec({
      fps: 24,
      speed: 1,
      quality: 100,
      format: 'mp4-h264',
      resize: {
        width: 1280,
        height: 720,
      },
    });

    expect(filterSpec.argument).toBe('-vf');
    expect(filterSpec.value).toContain('scale=1280:720:flags=lanczos');
    expect(filterSpec.value).toContain('pad=ceil(iw/2)*2:ceil(ih/2)*2');
    expect(filterSpec.value).toContain('format=yuv420p');
  });
});
