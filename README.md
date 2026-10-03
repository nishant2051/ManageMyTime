# ManageMyTime

Local-first web time-management application. The current scaffold provides an accessible, responsive welcome screen; task management and tracking are queued. No backend or account is required.

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
```

The build writes static output to `dist/`. Hosting and offline caching are later steps; this scaffold does not yet persist business data or operate offline after closing it.

## Architecture

- `src/app`: entry composition and dependency environment.
- `src/presentation`: React UI and styles.
- `src/application`: future use cases and coordination.
- `src/domain`: future models, policies and interfaces.
- `src/infrastructure`: future browser lifecycle, clocks and ownership adapters.
- `src/persistence`: future IndexedDB schema and repositories.

The last four layers contain scope notes only. Views will send commands to services; tracking mutations will go through a single SessionEngine and transactional repositories.

See [the active plan tracker](docs/06-Implementation-Plan-and-Vertical-Slices.md). This repository contains the web application and its active specifications.
