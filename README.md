# SST Sequencer

Desktop Electron app for converting between image sequences and videos, upscaling images or videos, and optionally removing backgrounds before export.
<img width="1919" height="1032" alt="image" src="https://github.com/user-attachments/assets/4f8f0af2-3f18-4d21-98ab-b1200c401b3f" />

## What It Does

- Convert a single image sequence into video
- Extract a single video into an image sequence
- Upscale a single image set directly
- Upscale a single video directly
- Batch-extract many videos into image sequences
- Batch-encode many sequence folders into videos
- Batch-upscale many image files
- Batch-upscale many videos
- Resize before export
- Upscale with native, JS, or Python-backed upscalers
- Remove backgrounds with bundled `rembg`
- Preserve alpha when the selected format and pipeline support it

## Workflows

### Single

- `Image Upscale`
- `Video Upscale`
- `Sequence to Video`
- `Video to Sequence`

### Batch

- `Batch Image Upscale`
- `Batch Video Upscale`
- `Batch Videos to Sequences`
- `Batch Sequences to Videos`

## Supported Formats

### Video output

- `MP4 (H.264)`
- `MP4 (H.265 / HEVC)`
- `MOV (H.264)`
- `MOV (H.265 / HEVC)`
- `MKV (H.264)`
- `MKV (H.265 / HEVC)`
- `ProRes 422`
- `ProRes 4444`
- `WebM (VP9)`
- `APNG`
- `GIF`

### Image sequence output

- `PNG`
- `JPG`
- `WEBP`
- `BMP`
- `TIFF`
- `TGA`

### Accepted animated/video-like input

- common video files handled by FFmpeg
- `GIF`
- `APNG`

## Background Removal

Background removal is available as a parameter in the transform workflows. It runs before upscale/export on source images or prepared frames.

Currently exposed models:

- `BiRefNet General`
- `BiRefNet General Lite`
- `BiRefNet Portrait`
- `U2Net`
- `U2NetP`
- `U2Net Human`
- `ISNet General Use`
- `ISNet Anime`

### Runtime split

- Bundled `rembg` CLI:
  - CPU
  - GPU on supported NVIDIA systems
- Fallback:
  - Python `3.11` runtime path if the CLI is unavailable

AMD systems currently fall back to CPU for `rembg`.

## Upscalers

Single and batch workflows support:

- `Nearest neighbor`
- `xBR.js`
- `pixel-scale-epx`
- `Real-ESRGAN Anime Video v3`
- `Real-CUGAN`
- `Waifu2x`
- `RealSR`
- `SwinIR`
- `DAT`
- `Anime4KCPP`

### Runtime split

- Native bundled backends:
  - `Real-ESRGAN`
  - `Real-CUGAN`
  - `Waifu2x`
  - `RealSR`
  - `Anime4KCPP`
- JS pixel-art backends:
  - `xBR.js`
  - `pixel-scale-epx`
- Optional Python backends:
  - `SwinIR`
  - `DAT`

## Alpha Handling

- The single upscale workflows support:
  - `Auto-detect`
  - `Force straight alpha`
  - `Force premultiplied alpha`
- Transparent inputs use split color/alpha processing.
- Alpha is scaled separately and merged back after the color upscale.

## Stack

- Electron
- React
- Vite
- Tailwind CSS
- FFmpeg / FFprobe
- TypeScript

## Requirements

### Base app

- Node.js
- npm

FFmpeg and FFprobe are bundled through `ffmpeg-static` and `ffprobe-static`.
The app also bundles native upscaler assets and the `rembg` CLI through `postinstall`.

### Optional Python backends

`SwinIR` and `DAT` require Python `3.11` plus extra packages at runtime. Use `Python 3.11 x64`.

- `SwinIR`
  - `torch`
  - `timm`
  - `numpy`
  - `opencv-python`
- `DAT`
  - `torch`
  - `timm`
  - `einops`
  - `numpy`
  - `opencv-python`

Example installs:

```powershell
py -3.11 -m pip install torch timm numpy opencv-python
py -3.11 -m pip install torch timm einops numpy opencv-python
```

If `py -3.11` is not available, use a Python 3.11 interpreter through `python` or `python3` instead.

## Scripts

- `npm install` also downloads bundled upscaler assets through `postinstall`
- `npm run dev` starts the Electron app in development mode
- `npm run build` type-checks and builds main, preload, and renderer
- `npm run preview` starts the production preview flow
- `npm run dist` builds and packages the app
- `npm run lint` runs ESLint
- `npm run lint:fix` runs ESLint with auto-fixes
- `npm run format` runs Prettier
- `npm run format:check` checks formatting
- `npm run test` runs Vitest once
- `npm run test:watch` runs Vitest in watch mode
- `npm run setup:realesrgan` installs bundled Real-ESRGAN assets
- `npm run setup:realcugan` installs bundled Real-CUGAN assets
- `npm run setup:waifu2x` installs bundled Waifu2x assets
- `npm run setup:realsr` installs bundled RealSR assets
- `npm run setup:swinir` downloads SwinIR architecture and weights
- `npm run setup:dat` downloads DAT architecture and weights
- `npm run setup:anime4kcpp` installs bundled Anime4KCPP assets
- `npm run setup:rembg` installs bundled `rembg` CLI assets

## Notes

- `Anime4KCPP` is currently only bundled on Windows.
- `SwinIR` and `DAT` are Python 3.11 backends, so packaging the desktop app does not embed a Python runtime.
- `xBR.js` and `pixel-scale-epx` are pixel-art-focused upscalers. They are not intended for painted, antialiased, or photo-like images.
- `rembg` GPU acceleration currently targets supported NVIDIA systems. Other systems fall back to CPU.

## UX Notes

- `Ctrl+V` paste for clipboard images is supported in:
  - `Sequence to Video`
  - `Image Upscale`
  - `Batch Image Upscale`
- Running jobs can be cancelled from the right-side action button while work is in progress.

## Project Layout

```text
src/
  main/
    app/        Electron window bootstrap
    ipc/        Main-process IPC handlers
    media/      FFmpeg/FFprobe/media services
  preload/      Renderer bridge API
  renderer/
    src/
      components/ Shared renderer UI
      features/   Workflow-specific UI and view models
      hooks/      Renderer side effects
      lib/        Renderer utilities
  shared/        Shared domain and IPC types
```

## Architecture Notes

- `main` owns filesystem, ffmpeg, ffprobe, dialogs, and IPC registration.
- `main/jobs/` owns workflow execution.
- `preload` is the only bridge between renderer and main.
- `renderer` owns workflow state, UI composition, and client-side validation.
- `shared` is the single source of truth for contracts and format metadata.
- `vendor/` stores downloaded native binaries, model files, and Python-backed architecture files used by optional upscalers.

## Common Work

### Add a workflow UI change

1. Start in `src/renderer/src/features/workflows/`.
2. Keep shared controls in `src/renderer/src/components/`.
3. Keep workflow-specific validation in `features/workflows/workflow-validation.ts`.

### Add or change a media format

1. Update `src/shared/formats.ts`.
2. Update main-process ffmpeg/output handling under `src/main/media/`.
3. Add or update tests for the affected helpers.

### Add or change an upscaler

1. Update `src/shared/upscalers/registry.ts`.
2. Add or update the backend under `src/main/media/`.
3. Wire it into the relevant job or pipeline layer under `src/main/jobs/` or `src/main/media/pipelines/`.
4. Add or update the installer under `scripts/` if the backend needs bundled assets.
5. Update tests for shared registry, validation, and pipeline/job behavior.

## Quality Gate

Before opening a PR or handing work off:

1. Run `npm run lint`
2. Run `npm run test`
3. Run `npm run build`
