# ManageMyTime

Local-first web time-management application. Task management is implemented: create/edit/complete/archive tasks with browser persistence and active/completed/archived filters. Manual tracking controls and session history are available. No backend or account is required.

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

Schema V2 preserves V1 tasks and adds session/recovery stores. The injectable-clock engine now has transactional Start/Pause/Resume/Complete/Switch commands. Task completion is coordinated with active tracking. Task cards offer Start/Resume/Switch; the current-session card offers Pause/Done and a monotonic elapsed timer. Cross-tab ownership renewal and synchronization are wired into the app. Session history shows ended totals, timestamps and end reasons. Open intervals are excluded from totals; follower tabs show unknown elapsed, and interrupted sessions await recovery actions in F03.

The build writes static output to `dist/`. Task records are stored in IndexedDB for this browser profile and origin. Clearing site data can remove them; export and offline app caching are later features. Changing the host or port uses a different origin and does not migrate data.

Browser tests use isolated contexts, including aborted-save and stale-tab scenarios. If Chromium is missing, run `npx playwright install chromium` before `npm run test:e2e`.

## Architecture

- `src/app`: entry composition and dependency environment.
- `src/presentation`: React UI and styles.
- `src/application`: task lifecycle and session engine.
- `src/domain`: task/session models, policies and interfaces.
- `src/infrastructure`: browser clocks, lifecycle and ownership coordination.
- `src/persistence`: IndexedDB schema, transactional commands and history readers.

Task models and repository interfaces live in the domain layer; TaskService validates and coordinates changes; the persistence adapter commits IndexedDB transactions before reporting success. Revision checks prevent stale task edits from overwriting another tab. Tracking mutations go through SessionEngine; browser coordination renews ownership and reconciles other tabs. UI timer observations do not invent work across reloads or uncertain interruptions.

See [the active plan tracker](docs/06-Implementation-Plan-and-Vertical-Slices.md). This repository contains the web application and its active specifications.

Tasks use previously worked hours as a starting balance. Displayed hours worked combine this balance, ended sessions, and known live elapsed time (HH:MM:SS). Editing the starting balance does not change session history. Schema V3 removes legacy progress percentages and initializes the starting balance to zero; percentages are not converted into hours. Reminder settings remain preferences only; periodic interval, inactivity interval (default 10 minutes), and grace are saved separately. Schema V4 adds the inactivity preference to existing tasks. Automatic checks are pending implementation. Unanswered prompts should end recorded time at the last activity or explicit confirmation, excluding inactivity and grace.
