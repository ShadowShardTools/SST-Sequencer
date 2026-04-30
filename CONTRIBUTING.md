# Contributing

## Workflow

1. Make focused changes.
2. Keep responsibilities separated by layer:
   main process, preload bridge, renderer UI, shared contracts.
3. Prefer extending an existing feature module over growing `App.tsx` or `media-service.ts`.

## Standards

- TypeScript stays `strict`.
- Prefer small pure helpers for reusable logic.
- Keep IPC payloads typed in `src/shared/`.
- Keep renderer components presentational unless they truly own state or side effects.
- Do not duplicate format definitions across layers.

## Testing and Validation

Run these before submitting:

1. `npm run lint`
2. `npm run test`
3. `npm run build`

## File Placement

- Shared UI: `src/renderer/src/components/`
- Workflow-specific renderer code: `src/renderer/src/features/`
- Main-process media logic: `src/main/media/`
- IPC handlers: `src/main/ipc/`
- Cross-layer contracts: `src/shared/`

## When Adding Code

- Put new pure logic behind a small test when practical.
- Prefer readable modules over generic abstractions.
- If a file starts carrying multiple responsibilities, split it before adding more.
