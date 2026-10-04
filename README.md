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

Schema V2 preserves V1 tasks and adds session/recovery stores. The injectable-clock engine now has transactional Start/Pause/Resume/Complete/Switch commands. Task completion is coordinated with active tracking. Task cards offer Start/Resume/Switch; the current-session card offers Pause/Done and a monotonic elapsed timer. Cross-tab ownership renewal and synchronization are wired into the app. Session history shows ended totals, timestamps and end reasons. Open intervals are excluded from totals; follower tabs show unknown elapsed, and interrupted sessions offer recovery actions.

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

Tasks use previously worked hours as a starting balance. Displayed hours worked combine this balance, ended sessions, and known live elapsed time (HH:MM:SS). Editing the starting balance does not change session history. Schema V3 removes legacy progress percentages and initializes the starting balance to zero; percentages are not converted into hours. Periodic interval, app-inactivity interval (default 10 minutes), and grace are saved separately. Schema V4 adds the inactivity preference to existing tasks. Automatic presence checks run while a session is tracked. Unanswered prompts end recorded time at the last activity or explicit confirmation, excluding inactivity and grace.

Presence alerts: open **Presence alerts** to enable browser system notifications and an optional chime; use **Test sound** to check audio and **Mute sound** to disable it. Sound is off again after reload. The app shows one owner-tab popup with **I’m still working** and **Pause tracking**. A timely confirmation retains elapsed time; an unanswered prompt excludes all time after the last detected activity or confirmation. System notification clicks only return to the app.

Activity means trusted keyboard/pointer/touch/wheel interactions within the tracking tab. Work in other applications may trigger an inactivity prompt. Keep the tab open; background timers and alerts can be delayed or suppressed by the browser/OS. Unexpected runtime gaps or reloads require you to resolve the saved session before starting again. No guarantee of closed-tab reminders or an overlay above every application.

Chime playback uses a bundled 1.8-second two-note WAV at 80% volume. Enable sound plays it immediately; Test sound restarts it and Mute sound stops playback. Playback rejection is reported rather than silently skipped. The browser cannot detect muted tabs or system output volume. Optional browser-specific tests can use `E2E_BROWSER_EXECUTABLE` to select a Chromium-compatible browser executable, such as Brave, in an isolated Playwright profile.

**Refresh tracking** reloads persisted session ownership and history without restarting or resetting the timer. After a reload or closed owner tab, ownership can take up to one minute to expire. A live owner in another tab is protected.

Interrupted sessions offer **End at suggested time**, **Save end time**, and **Discard session** (with confirmation). Suggested time uses the last recorded app activity/confirmation or a pending prompt cutoff; runtime checkpoints are displayed separately and do not prove work. Custom end times use your current local timezone and must fall between the session start and now without overlapping other history. Saved recovery entries are marked corrected and the timer stays paused until you explicitly start/resume. Discard removes only the interrupted session.

Current development preference: do not add or run automated tests; the user will validate behavior manually and provide feedback. Build/typecheck/lint are still used for static verification.
