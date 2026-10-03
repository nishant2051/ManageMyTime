# ManageMyTime

Local-first web time-management application. Task management is implemented: create/edit/complete/archive tasks with browser persistence and active/completed/archived filters. Time tracking is queued. No backend or account is required.

## Development

Requires Node.js 22.12+ (Node 24.4.1 verified) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Stop the development server with Ctrl+C.

```sh
npm run typecheck
npm run lint
npm run build
npm run preview
npm test
npm run test:e2e
```

The build writes static output to `dist/`. Task records are stored in IndexedDB for this browser profile and origin. Clearing site data can remove them; export and offline app caching are later features. Changing the host or port uses a different origin and does not migrate data.

Browser tests use isolated contexts, including aborted-save and stale-tab scenarios. If Chromium is missing, run `npx playwright install chromium` before `npm run test:e2e`.

## Architecture

- `src/app`: entry composition and dependency environment.
- `src/presentation`: React UI and styles.
- `src/application`: future use cases and coordination.
- `src/domain`: future models, policies and interfaces.
- `src/infrastructure`: future browser lifecycle, clocks and ownership adapters.
- `src/persistence`: future IndexedDB schema and repositories.

Task models and repository interfaces live in the domain layer; TaskService validates and coordinates changes; the persistence adapter commits IndexedDB transactions before reporting success. Revision checks prevent stale task edits from overwriting another tab. Infrastructure remains reserved for future browser adapters. Tracking mutations will go through a single SessionEngine in F02.

See [the active plan tracker](docs/06-Implementation-Plan-and-Vertical-Slices.md). This repository contains the web application and its active specifications.
