# 06 — Web Implementation Plan and Feature Tracker

**Last reviewed:** 2026-10-04 (Asia/Kolkata)

**Scope:** Local-first web MVP; React + TypeScript + Vite; IndexedDB

**Current feature in progress:** None; documentation migration completed

**Recommended next step:** F01 — Persistent task management

## Current implementation status

- **Implemented product features:** None.
- **In progress product features:** None.
- **Completed planning:** Web scope, architecture, persistence, component boundaries, tracking rules, UX, privacy and tracker revised.
- **Implemented foundation:** React/TypeScript/Vite scaffold and responsive welcome screen.
- **Current blocker:** None. Node 24.4.1/npm 11.4.2 verified; web production build, type check, lint and browser smoke checks pass.

The active project is web-only. Desktop source, packaging files, generated Swift build output and archived desktop specifications were removed at the user’s request.

## Active design documents

| Document | Current contract |
| --- | --- |
| [01 — PRD](01-Activity-Aware-Time-Management-PRD.md) | Included web requirements and deferred native capabilities. |
| [02 — Architecture](02-System-Architecture.md) | Browser runtime, TypeScript layers, IndexedDB transactions, multi-tab ownership, offline shell. |
| [03 — Persistence](03-Database-Design.md) | Store schema, relationships, migrations, invariants and exports. |
| [04 — Interfaces](04-Component-Interface-Design.md) | Component ownership and command/repository boundaries. |
| [05 — Tracking rules](05-Session-State-Machine-and-Tracking-Rules.md) | Manual timing, interruptions, confirmation, recovery and stale events. |
| [07 — UI/UX](07-UI-UX-Specification.md) | Responsive screens, prompt/recovery UX and capability communication. |
| [09 — Privacy/security](09-Privacy-Permissions-and-Security.md) | Browser storage/data boundaries and security acceptance. |

Active web contracts define the implementation scope. Retain the existing PRD filename for link continuity; device-wide activity detection is deferred.

## Status rules

| Status | Meaning |
| --- | --- |
| Queued | Planned; implementation has not started. |
| In progress | Currently being implemented; record completed and remaining steps. |
| Implemented | Acceptance passes with linked code and validation evidence. |
| Blocked | Record concrete blocker and action required. |
| Skipped | Deliberately excluded from current MVP; record reason/revisit trigger. |

Build one feature at a time. Update this file before moving on. Code presence is not proof of a working feature; partial acceptance remains in progress or blocked. M01 is a planning deliverable, not an implemented product feature.

## Ordered tracker

| ID | Work item | Status | Dependencies | Acceptance / remaining work |
| --- | --- | --- | --- | --- |
| M01 | Web documentation migration | Implemented | User-approved direction | Seven active specs and tracker revised; desktop specifications removed; no native toolchain dependency. Evidence: these documents and change log. |
| W00 | Web scaffold | Implemented | M01 | React/TypeScript/Vite app launches locally; production build, type check and lint pass; logical layers, accessible welcome screen and setup README. Root project contains only the active web scaffold. |
| T00 | Browser feasibility checks | Queued | W00 | Probe IndexedDB commits/abort, simultaneous tabs, owner death, suspension/reload, migrations, quota failure and offline shell. Run each check before relying on that capability; record browser results. |
| F01 | Persistent tasks | Queued | W00; storage T00 | Create/list/edit/complete/archive; three types, notes, optional progress and editable confirmation defaults; filters; reload restores data; save failures honest. |
| F02 | Manual sessions | Queued | F01; multi-tab T00 | Start/Pause/Resume/Done/Switch; one open session across same-origin tabs; committed transaction before success; live elapsed display and basic history; no overlaps. |
| F03 | Interrupted-session recovery | Queued | F02; lifecycle T00 | Orphaned/suspended runtime enters recovery; live second-tab owner not incorrectly recovered; defensible boundary/user correction; no silent resume or invented downtime. |
| F04 | In-app prompt coordination | Queued | F03 | One actionable prompt, stale IDs/generations ignored, collision precedence, no guaranteed closed-tab/background delivery. |
| F05 | Device-wide inactivity | Skipped | Native companion or validated future browser enhancement | Plain web MVP does not observe global keyboard/mouse activity. Page blur/inactivity must not pause work automatically. |
| F06 | Periodic confirmation | Queued | F04 | Per-task interval/grace; Yes continues; No/unanswered closes at due boundary when runtime is reliable; overdue prompts after suspension route through recovery. |
| F07 | App monitoring/associations | Skipped | Future native companion | Browser cannot implement the specified frontmost native-app monitoring/allowed-app list. |
| F08 | Today todos | Queued | F01 | Flat dated todos, completion, optional notes/progress/estimate/deadline/task link; persistence and local-date validation. |
| F09 | Planner | Queued | F04, F06, F08 | Task/break blocks; explicit switch/overrun choices; missed boundaries reconcile; plans independent of sessions. No dependency on skipped F07. |
| F10 | Timeline/corrections | Queued | F03, F09 | Actual/planned display; unknown gaps; manual add/edit/delete/reassign ended sessions with provenance and global overlap validation. |
| F11 | Analytics | Queued | F09–F10 | Daily/weekly/monthly totals and statistics; task breakdown/trends/planned-vs-actual; cross-midnight and timezone/DST range clipping. |
| F12 | Complete dashboard | Queued | F08–F11 | Current session, next block and today summaries consistent with committed records; early active-session card delivered in F02. |
| F13 | Settings/privacy | Queued | F06 | Defaults affect new tasks only; local-data/runtime-limit explanations; honest storage capability; no native permission controls. |
| F14 | Export/data deletion | Queued | F10, F13 | Versioned JSON and safe session CSV; explicit export; confirmed permanent delete/reset with cascade/nullify and cross-tab invalidation. |
| F15 | Offline and release hardening | Queued | T00; all included features | Offline shell after first load; safe updates/migrations; Chrome/Safari/Firefox/Edge checks; failure/recovery/race tests; keyboard accessibility, responsive layout and privacy/security review. |
| W01 | Hosting/deployment | Queued | F15; explicit publish request | Provider/domain chosen; HTTPS deployment; no uploads of local business data; explain stable-origin data behavior. No deployment authorized by documentation work. |

IDs F01–F15 retain continuity with the original tracker. Skipped IDs never block included features. Exports should be brought forward if real user history is stored before the full MVP is complete; document any change in order.

## Next: W00 — Web scaffold, broken into steps

| Step | Deliverable | Status | Completion criteria |
| --- | --- | --- | --- |
| W00.1 | Check toolchain and choose dependency versions | Implemented | Verify Node/package manager availability and compatible current package versions; record prerequisites. |
| W00.2 | Web-only project layout | Implemented | Root README and scripts identify the web app; desktop source and archives removed at the user’s request. |
| W00.3 | Create React/TypeScript/Vite scaffold | Implemented | Runnable app with development/build/type-check/lint commands and no backend requirement. |
| W00.4 | Composition root and logical layers | Implemented | app, presentation, application, domain, infrastructure, persistence folders; no mock features presented as implemented. |
| W00.5 | Accessible responsive welcome screen | Implemented | Browser launches and screen renders on desktop/narrow viewport; no native monitoring claims. |
| W00.6 | Build verification and tracker update | Implemented | Production build/type-check/lint plus smoke launch pass; link source and evidence; propose F01 next. |

Do not implement tasks, sessions, IndexedDB business stores or full navigation as part of W00. Their contracts belong to their own slices.

## F01 — Persistent tasks, broken into steps

1. Domain task/type/lifecycle and confirmation policy: trimmed name 1–200, optional progress 0–100, valid enabled intervals, duplicate names allowed.
2. Versioned IndexedDB schema and typed task repository; transaction completion determines save success.
3. TaskService create/edit/complete/archive; validation outside UI; stable UUID/timestamps; defaults copied at creation.
4. Task list and editor with filters, empty/error states and accessible controls. Do not expose Start until F02.
5. Domain and browser persistence checks: reload, failed saves, lifecycle/default isolation, invalid inputs and schema upgrades.
6. Record source/validation evidence; mark implemented only after acceptance passes.

## F02–F03 — Tracking foundation

Implement transactional session creation/end/switch/completion, injected clocks and command serialization. Validate two tabs starting simultaneously before trusting tracking. Add live elapsed and basic persisted history. Then establish checkpoint cadence/runtime-gap threshold, ownership reconciliation and recovery UI; user-confirmed and runtime-checkpoint timestamps are distinct. Ended-session totals must not silently include uncertain closed/suspended intervals. Finish this foundation before confirmation or planner prompts.

## Skipped/deferred capability register

| Capability | Status | Reason / revisit trigger |
| --- | --- | --- |
| Native global activity, app associations, exact sleep/lock events and automatic activity classification | Skipped | Native/browser capability redesign required; manual controls are current authority. |
| Optional browser Idle Detection | Skipped | Limited browser coverage; evaluate later with contextual permission and fallback. |
| System notifications, push and guaranteed closed-tab reminders | Skipped | In-app prompts only; browser background execution cannot provide original native guarantee. |
| Accounts/backend/cloud sync, team collaboration | Skipped | Local-first, single-profile MVP; separate security/sync design required. |
| Subtasks, recurring schedules, calendar integrations, browser extensions, AI schedules, productivity scores | Skipped | Retained product non-goals. |
| Automated backups and import/restore | Skipped | Explicit export is MVP portability; restore workflow requires its own validated design. |

Input contents, screenshots, raw activity history and browsing history are prohibited collection, not future backlog.

## Evidence and decisions log

| Date | Item | Outcome / evidence | Remaining |
| --- | --- | --- | --- |
| 2026-10-04 | M01 | Active docs rewritten for local-first web; desktop specifications removed; tracker now reflects browser limits, multi-tab integrity and queued web work. | W00 completed subsequently; no business feature implementation yet. |

Chosen assumption follows the proposed local-first MVP: IndexedDB, no backend/accounts, manual tracking with in-app confirmation. Revisit if the user requests sync or full device activity detection.

Open implementation decisions: dependency versions; supported browser versions; multi-tab lease/checkpoint/gap parameters; exact offline update strategy; hosting provider. Validate during the corresponding slice rather than making unverifiable guarantees now.

### W00 evidence — 2026-10-04

- Runtime: Node 24.4.1, npm 11.4.2; React 19.3.0, Vite 8.3.2 and plugin-react 6.1.1. Exact installed dependencies are locked in [package-lock.json](../package-lock.json).
- Source/configuration: [package.json](../package.json), [app composition](../src/app/environment.ts), [app entry](../src/main.tsx), [welcome screen](../src/presentation/WelcomeScreen.tsx), [styles](../src/presentation/styles.css).
- Passed: `npm run build` (includes `npm run typecheck`), `npm run lint`; npm installation audit reported zero vulnerabilities.
- Browser smoke: welcome heading and expected content rendered at `http://127.0.0.1:5173/`; visual desktop/default and 375px narrow-screen inspection; document width equaled viewport width at 375px. No application business tests are appropriate yet. Full browser/screen-reader matrix remains F15.
- Scope: no tasks, sessions, business persistence, service worker or deployment added. Development preview remains available while its server runs.
- Next: F01 persistent task management; T00 storage validation before relying on IndexedDB.

- Cleanup: Removed desktop source, native packaging/resources, archived desktop specs and `.build` output at the user’s request. Revalidated web build, lint and local document links before commit.
