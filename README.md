# SST Sequencer

Desktop Electron app for converting image sequences to video and extracting image sequences from video.

## Stack

- Electron
- React
- Vite
- Tailwind CSS
- FFmpeg / FFprobe
- TypeScript

## Scripts

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
- `preload` is the only bridge between renderer and main.
- `renderer` owns workflow state, UI composition, and client-side validation.
- `shared` is the single source of truth for contracts and format metadata.

## Common Work

### Add a workflow UI change

1. Start in `src/renderer/src/features/workflows/`.
2. Keep shared controls in `src/renderer/src/components/`.
3. Keep workflow-specific validation in `features/workflows/model.ts`.

### Add or change a media format

1. Update `src/shared/formats.ts`.
2. Update main-process ffmpeg/output handling under `src/main/media/`.
3. Add or update tests for the affected helpers.

## Quality Gate

Before opening a PR or handing work off:

1. Run `npm run lint`
2. Run `npm run test`
3. Run `npm run build`
