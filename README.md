# SST Sequencer

Desktop Electron app for converting between image sequences and videos, upscaling images or videos, and optionally removing backgrounds before export. Packaged builds include the bundled AI runtimes needed by the current backends.

<img width="1919" height="1034" alt="image" src="https://github.com/user-attachments/assets/ca0e2739-a8c8-457e-ac92-b6ee721c92d9" />

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

- Bundled `rembg` CLI is included in packaged builds.
- Build profiles:
  - `CPU` ships the `rembg` CPU CLI
  - `DirectML` ships the `rembg` CPU CLI
  - `CUDA Lite` and `CUDA Full` ship the `rembg` GPU CLI for supported NVIDIA systems
- Some large `rembg` model weights, especially `BiRefNet` variants, are not bundled and may download on first use.

AMD and Intel systems currently use CPU for `rembg`.

## Upscalers

Single and batch workflows support:

- `Nearest neighbor`
- `xBR.js`
- `pixel-scale-epx`
- `Real-ESRGAN`
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
- Python-backed backends:
  - `SwinIR`
  - `DAT`

Most packaged builds do not require a separate Python install for `SwinIR` or `DAT`. The `cuda-lite` build keeps their model assets but expects an external Python 3.11 environment with the required packages.

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
The app also downloads native upscaler assets, `rembg`, and the optional Python runtimes used by `SwinIR` and `DAT` through `postinstall`.

### Packaged app

`CPU`, `DirectML`, and `CUDA Full` installers do not require users to install Python, `torch`, or `rembg` separately.

`CUDA Lite` still includes `DAT` and `SwinIR` model assets, but expects the user to install Python `3.11` plus:

- `torch`
- `timm`
- `numpy`
- `opencv-python`
- `einops` for `DAT`

### Development fallback

The app can still fall back to an external Python environment in development, but that is no longer required for normal packaged use.

## Scripts

- `npm install` also downloads bundled upscaler assets through `postinstall`
- `npm run dev` starts the Electron app in development mode
- `npm run build` type-checks and builds main, preload, and renderer
- `npm run preview` starts the production preview flow
- `npm run dist` builds and packages the default `CPU` profile
- `npm run dist:cpu` builds the `CPU` profile
- `npm run dist:cuda` aliases to `npm run dist:cuda-full`
- `npm run dist:cuda-lite` builds the `CUDA Lite` profile
- `npm run dist:cuda-full` builds the `CUDA Full` profile
- `npm run dist:directml` builds the `DirectML` profile
- `npm run dist:all` builds all four installer profiles
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
- `npm run setup:python311` installs the bundled CUDA Python 3.11 runtime
- `npm run setup:python311-cpu` installs the bundled CPU Python 3.11 runtime
- `npm run setup:python311-directml` installs the bundled DirectML Python 3.11 runtime
- `npm run setup:swinir` downloads SwinIR architecture and weights
- `npm run setup:dat` downloads DAT architecture and weights
- `npm run setup:anime4kcpp` installs bundled Anime4KCPP assets
- `npm run setup:rembg` installs bundled `rembg` CLI assets

## Build Profiles

- `CPU`
  - output: `release/cpu`
  - bundles `python311-cpu` and `rembg` CPU
- `CUDA Lite`
  - output: `release/cuda-lite`
  - bundles `rembg` GPU plus `DAT` / `SwinIR` model assets
  - expects external Python 3.11 with:
    - `torch`
    - `timm`
    - `numpy`
    - `opencv-python`
    - `einops` for `DAT`
- `CUDA Full`
  - output: `release/cuda-full`
  - bundles `python311` and `rembg` GPU
- `DirectML`
  - output: `release/directml`
  - bundles `python311-directml` and `rembg` CPU

## Notes

- `Anime4KCPP` is currently only bundled on Windows.
- `SwinIR` and `DAT` are fully bundled in `CPU`, `DirectML`, and `CUDA Full`. `CUDA Lite` relies on an external Python 3.11 environment for them.
- `xBR.js` and `pixel-scale-epx` are pixel-art-focused upscalers. They are not intended for painted, antialiased, or photo-like images.
- `rembg` GPU acceleration currently targets supported NVIDIA systems. Other systems fall back to CPU.
- Large `rembg` weights such as `BiRefNet` variants are exposed in the UI, but not all of them are prebundled into the installer because of size.

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
