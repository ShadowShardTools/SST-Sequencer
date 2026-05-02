# Contributing

## Local Setup

1. Install Node.js and npm.
2. Run:

```powershell
npm install
```

This also runs the asset setup scripts from `postinstall` and populates `vendor/` with bundled upscaler resources.

If you work on optional Python backends, install the matching runtime dependencies too:

```powershell
py -3 -m pip install torch timm numpy opencv-python
py -3 -m pip install torch timm einops numpy opencv-python
```

Use `python` or `python3` if `py -3` is not available on your machine.

## Workflow

1. Make focused changes.
2. Keep responsibilities separated by layer:
   main process, preload bridge, renderer UI, shared contracts.
3. Prefer extending an existing feature module over growing `App.tsx` or `media-service.ts`.
4. Update docs when user-visible behavior, supported formats, or setup/runtime requirements change.

## Standards

- TypeScript stays `strict`.
- Prefer small pure helpers for reusable logic.
- Keep IPC payloads typed in `src/shared/`.
- Keep renderer components presentational unless they truly own state or side effects.
- Do not duplicate format definitions across layers.
- Keep format labels, upscaler labels, validation rules, and platform support rules in `src/shared/`.
- Prefer behavior-preserving refactors over broad rewrites when touching the media pipeline.

## Testing and Validation

Run these before submitting:

1. `npm run lint`
2. `npm run test`
3. `npm run build`

If you changed formatting-heavy files, also run:

4. `npm run format:check`

If you touched installer/setup scripts or optional backends, run the relevant setup command too:

- `npm run setup:realesrgan`
- `npm run setup:realcugan`
- `npm run setup:waifu2x`
- `npm run setup:realsr`
- `npm run setup:swinir`
- `npm run setup:dat`
- `npm run setup:anime4kcpp`

## File Placement

- Shared UI: `src/renderer/src/components/`
- Workflow-specific renderer code: `src/renderer/src/features/`
- Main-process media logic: `src/main/media/`
- IPC handlers: `src/main/ipc/`
- Cross-layer contracts: `src/shared/`
- Bundled native/model assets: `vendor/`
- Asset/bootstrap installers: `scripts/`

## When Adding Code

- Put new pure logic behind a small test when practical.
- Prefer readable modules over generic abstractions.
- If a file starts carrying multiple responsibilities, split it before adding more.

## When Adding or Changing an Upscaler

1. Update `src/shared/formats.ts`.
2. Add or update the backend under `src/main/media/`.
3. Wire it into `src/main/media-service.ts`.
4. Add or update the setup script in `scripts/` if the backend needs downloaded assets.
5. Update the renderer label and helper note in:
   - `src/renderer/src/App.tsx`
   - `src/renderer/src/lib/media.ts`
6. Update `README.md` and this file if setup/runtime requirements changed.

## Backend Notes

- Native bundled backends currently include:
  - `Real-ESRGAN`
  - `Real-CUGAN`
  - `Waifu2x`
  - `RealSR`
  - `Anime4KCPP`
- Optional Python backends currently include:
  - `SwinIR`
  - `DAT`
- Transparent single-workflow upscales use split color/alpha processing with separate alpha scaling.
- Batch workflows are primarily format-conversion flows; single workflows carry the AI upscale path.
