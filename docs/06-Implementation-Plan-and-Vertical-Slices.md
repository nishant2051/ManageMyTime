# 06 — Web Implementation Plan and Feature Tracker

**Last reviewed:** 2026-10-04 (Asia/Kolkata)

**Scope:** Local-first web MVP; React + TypeScript + Vite; IndexedDB

**Current feature in progress:** F03 — Interrupted-session recovery; controls implemented, awaiting manual feedback

**Recommended next step:** Manual feedback on interrupted-session recovery; no new automated tests per user request

## Current implementation status

- **Implemented product features:** F01 — Persistent task management.
- **In progress product features:** F02 — Manual work-session tracking.
- **Completed planning:** Web scope, architecture, persistence, component boundaries, tracking rules, UX, privacy and tracker revised.
- **Implemented foundation:** React/TypeScript/Vite scaffold, task domain/service, IndexedDB Schema V4, session record models and Tasks interface.
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
| T00 | Browser feasibility checks | In progress | W00 | Probe IndexedDB commits/abort, simultaneous tabs, owner death, suspension/reload, migrations, quota failure and offline shell. Run each check before relying on that capability; record browser results. |
| F01 | Persistent tasks | Implemented | W00; storage T00 | Create/list/edit/complete/archive; three types, notes, previous hours and editable confirmation defaults; filters; reload restores data; save failures honest. |
| F02 | Manual sessions | In progress | F01; multi-tab T00 | Start/Pause/Resume/Done/Switch; one open session across same-origin tabs; committed transaction before success; live elapsed display and basic history; no overlaps. |
| F03 | Interrupted-session recovery | In progress | F02; lifecycle T00 | Suggested/custom end and confirmed discard implemented; live owners protected; user manual validation pending. |
| F04 | In-app prompt coordination | In progress | F03 | One actionable prompt, stale IDs/generations ignored, collision precedence, no guaranteed closed-tab/background delivery. |
| F05 | Device-wide inactivity | Skipped | Native companion or validated future browser enhancement | Plain web MVP does not observe global keyboard/mouse activity. Page blur/inactivity must not pause work automatically. |
| F06 | Presence confirmation | In progress | F04 | Periodic/app-inactivity/grace prompts implemented; Yes continues; No/unanswered closes at last activity/confirmation. Full recovery integration remains. |
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

- [x] Domain task/type/lifecycle and confirmation policy: trimmed name 1–200, finite nonnegative previous hours, valid enabled intervals, duplicate names allowed.
- [x] Versioned IndexedDB schema and typed task repository; transaction completion determines save success.
- [x] TaskService create/edit/complete/archive; validation outside UI; stable UUID/timestamps; defaults copied at creation.
- [x] Task list and editor with filters, empty/error states and accessible controls. Do not expose Start until F02.
- [x] Domain and browser persistence checks: reload, failed saves, lifecycle/default isolation, invalid inputs and schema upgrades.
- [x] Record source/validation evidence; mark implemented only after acceptance passes.

## F02 — Smaller-step tracker

| Step | Deliverable | Status | Evidence / remaining |
| --- | --- | --- | --- |
| F02.1 | Session models and database upgrade | Implemented | WorkSession, active-session marker and recovery evidence types; shared Schema V2 opener; V1 tasks preserved; migration/rollback/blocked-upgrade tests. No session write commands yet. |
| F02.2 | Session engine and injectable clocks | Implemented | Serialized command pipeline, immutable subscriptions, injected clock, committed reads and conservative runtime elapsed. Production Start/Pause/Resume writer added in F02.3. |
| F02.3 | Start/Pause/Resume | Implemented | Atomic session/marker/recovery writes; new session on Resume; task eligibility, overlap, identity/generation and owner checks; rollback and concurrent-tab Start tests pass. UI controls remain F02.6. |
| F02.4 | Complete and Switch | Implemented | Atomic related record changes and failure handling; coordinate TaskService lifecycle with engine. |
| F02.5 | Cross-tab single-session protection | Implemented | Ownership/generation rules, database invariant enforcement, stale command rejection and concurrent-tab tests. Singleton stores alone do not enforce this rule. |
| F02.6 | Timer and basic history UI | Implemented | Start/Resume/Switch, Pause/Done, monotonic live timer, ended totals and persisted history; follower/recovery/error states; responsive browser workflows. |
| F02.7 | Feature verification and tracker update | Queued | Transition/timing/race/failure tests; mark full F02 implemented only after all steps pass. |

## F02–F03 — Tracking foundation

Implement transactional session creation/end/switch/completion, injected clocks and command serialization. Validate two tabs starting simultaneously before trusting tracking. Add live elapsed and basic persisted history. Then establish checkpoint cadence/runtime-gap threshold, ownership reconciliation and recovery UI; user-confirmed and runtime-checkpoint timestamps are distinct. Ended-session totals must not silently include uncertain closed/suspended intervals. Finish this foundation before confirmation or planner prompts.

## Skipped/deferred capability register

| Capability | Status | Reason / revisit trigger |
| --- | --- | --- |
| Native global activity, app associations, exact sleep/lock events and automatic activity classification | Skipped | Native/browser capability redesign required; manual controls are current authority. |
| Optional browser Idle Detection | Skipped | Limited browser coverage; evaluate later with contextual permission and fallback. |
| Push and guaranteed closed-tab reminders | Skipped | Optional system notifications are implemented while the app executes; closed-tab and suspended delivery remain unguaranteed. |
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
- Source/configuration: [package.json](../package.json), [app composition](../src/app/environment.ts), [app entry](../src/main.tsx), [current Tasks screen](../src/presentation/TasksScreen.tsx) (replaced the initial welcome screen in F01), [styles](../src/presentation/styles.css).
- Passed: `npm run build` (includes `npm run typecheck`), `npm run lint`; npm installation audit reported zero vulnerabilities.
- Browser smoke: welcome heading and expected content rendered at `http://127.0.0.1:5173/`; visual desktop/default and 375px narrow-screen inspection; document width equaled viewport width at 375px. No application business tests are appropriate yet. Full browser/screen-reader matrix remains F15.
- Scope: no tasks, sessions, business persistence, service worker or deployment added. Development preview remains available while its server runs.
- Next: F01 persistent task management; T00 storage validation before relying on IndexedDB.

- Cleanup: Removed desktop source, native packaging/resources, archived desktop specs and `.build` output at the user’s request. Revalidated web build, lint and local document links before commit.

### F01 evidence — 2026-10-04

- Completed smaller steps: task domain/validation; IndexedDB Schema V1 repository; create/edit/complete/archive service; Tasks list/editor with filters and empty/error states; automated verification; tracker update.
- Source: [domain models](../src/domain/task.ts), [service](../src/application/taskService.ts), [IndexedDB adapter](../src/persistence/taskRepository.ts), [Tasks screen](../src/presentation/TasksScreen.tsx), [editor](../src/presentation/TaskEditor.tsx).
- Validation: production build/type check and lint pass; 18 domain/repository tests and 6 Chromium browser tests pass. Coverage includes reload persistence, duplicate names, validation, default isolation, timestamps, archived-edit rejection, aborted transactions, unavailable storage, stale edits across tabs, dialog focus and narrow-screen layout.
- Tests: [domain/repository tests](../src/application/taskService.test.ts), [browser tests](../tests/tasks.spec.ts). Real-browser storage probes for F01 passed; T00 remains queued for session ownership, lifecycle, migration fixtures, quota and offline checks in later slices.
- Manual visual inspection: Tasks empty state and modal editor rendered correctly in local preview. Browser tests use isolated storage and do not leave sample records in the user's profile.
- Limits: user-editable global defaults/settings remain F13; confirmation values are saved preferences only, no reminder runtime exists yet. No Start/Pause/Resume or permanent delete/export controls added. Full browser matrix remains F15.
- User reviewed and approved F01. Publication: commit and push authorized; F02 remains queued.

### F01 review — 2026-10-04

User approved the completed task-management feature and authorized committing/pushing it. All six F01 steps are complete; validation evidence is recorded above. F02 remains queued.

### F02.1 evidence — 2026-10-04

- Models: [work-session contracts](../src/domain/workSession.ts) define epoch timestamps, task identity, source/correction provenance, nullable paired end/reason, timezone, revision, active ownership marker and separate runtime/user-confirmed recovery evidence. Ended-duration and half-open overlap helpers do not invent open-session duration.
- Persistence: [shared database opener](../src/persistence/database.ts) upgrades V1 to V2 with workSessions (taskId/startedAt indexes), activeSession and recovery stores. Tasks and status index remain unchanged. Task repository now uses the shared opener.
- Verification: build/type check and lint pass; 33 domain/repository tests and 7 Chromium tests pass, including populated V1 migration, aborted migration rollback/retry, blocked upgrade retry, unchanged task fields and existing task workflow regression.
- Tests: [session model tests](../src/domain/workSession.test.ts), [database tests](../src/persistence/database.test.ts), [browser migration test](../tests/migration.spec.ts). T00 migration probes complete for this schema; ownership/lifecycle/quota/offline probes remain outstanding.
- Scope: no tracking controls, clock runtime, session mutations or live single-session enforcement added. F02 remains in progress; full recovery is F03. No automatic commit or push.
- Next: F02.2 session engine/clock foundation.

### F02.2 evidence — 2026-10-04

- Foundation: [SessionEngine](../src/application/sessionEngine.ts), [clock contract](../src/domain/clock.ts), [BrowserClock](../src/infrastructure/browserClock.ts), [session reader/command contracts](../src/domain/sessionStore.ts), [IndexedDB session reader](../src/persistence/sessionReader.ts). The composition root constructs one engine; the Tasks UI does not dispatch tracking actions yet.
- Engine queues commands/reads/observations, isolates subscriber failures, clones/freezes snapshots and queued command input, rejects invalid state/clocks and only publishes command results after handler commit. Rejected operations do not poison the queue.
- Live elapsed is monotonic runtime duration, not accumulated ticks. Reloaded sessions cannot recreate an anchor. Existing foreign unexpired ownership is followed; ambiguous runtime, expired ownership or clock discontinuity requires recovery without mutating history.
- [Timing decision](decisions/001-runtime-clock-foundation.md) records injectable initial gap/drift thresholds and their limits. No automatic polling, checkpoint writes or recovery dialog added.
- Validation: production build/type check and lint pass; 51 domain/repository/engine tests and 7 Chromium task/migration regression tests pass. Engine tests use injected fake command handlers; they do not claim production Start/Pause/Resume implementation.
- Limits: transaction-backed session writes are F02.3/F02.4; database-enforced cross-tab tracking ownership is F02.5; timer/history UI is F02.6; complete interruption recovery is F03. F02 remains in progress.
- Next: F02.3 Start/Pause/Resume. No automatic commit or push performed.

### F02.3 evidence — 2026-10-04

- Production commands: [IndexedDBSessionCommands](../src/persistence/sessionCommands.ts) is wired to the SessionEngine in the composition root. Start/Resume validate active tasks and global history, then atomically insert an open session, owner marker and recovery evidence. Pause ends the identified session at command time and removes marker/evidence in the same transaction.
- Resume requires prior ended tracked history and creates a fresh UUID; paused gaps are not included. Repeated/stale Pause, mismatched generation/owner, second Start, incomplete recovery evidence, invalid tasks and overlapping boundaries are rejected without successful state publication.
- Integrity: task lifecycle updates share the workSessions transaction scope and refuse completion/archive of an open-session task until F02.4 supplies coordinated completion. No existing task record is silently changed by tracking.
- Ownership: an initial 60-second lease is stored; no renewal/takeover/listener scheduling exists yet. Unique session identity plus generation protects stale Pause. Database readwrite scopes enforce a single open session even across independent tabs. Full cross-tab coordination remains F02.5 and interruption recovery F03.
- Validation: production build/type check and lint pass; 62 unit/integration tests and 9 Chromium tests pass. Added tests cover discrete persisted sessions, excluded pause intervals, unsupported tasks, duplicate starts, stale actions, aborted Start/Pause rollback/retry, task lifecycle guard and backward-clock overlap. Chromium verifies real persisted command flow and simultaneous two-tab Starts.
- Tests: [transactional command tests](../src/persistence/sessionCommands.test.ts), [browser command tests](../tests/sessionCommands.spec.ts). All browser data is isolated to test contexts.
- Scope: no visible tracking controls or timer/history UI; Complete/Switch commands still explicitly unavailable. F02 remains in progress. No automatic commit or push performed.
- Next: F02.4 Complete and Switch.


### F02.4 — Complete and Switch implemented

- Complete closes active work and completes its task in one transaction. TaskService in the production composition now routes completion through the engine, preserving task revision and session identity/generation checks.
- Switch ends the previous session and starts the selected eligible task at the same boundary. Both commands reject stale actions, foreign ownership and unresolved confirmation evidence.
- Failure tests verify that aborted Complete/Switch transactions preserve the original task, session, marker and recovery evidence. Completing another task preserves the running session.
- Verification: 67 unit tests and 10 browser tests pass; lint, typecheck and production build pass.
- Tracking controls/history UI remain F02.6; ownership renewal and coordination remain F02.5. F02 stays in progress. No commit or push performed.
- Next: F02.5 — Cross-tab single-session protection.


### F02.5 — Cross-tab single-session protection implemented

- Transactions enforce one open session and validate owner, session identity, generation, lease and matching checkpoint evidence. Expired owners cannot renew or terminate tracking until explicit recovery.
- Visible owner checkpoints run every 15 seconds, renewing the 60-second lease and updating recovery evidence atomically. They do not imply user confirmation or change history.
- A disposable app coordinator uses BroadcastChannel change hints and periodic polling, including when channels are unavailable/restricted. Visibility, focus and page restoration reconcile immediately. Cleanup removes timers, listeners and channels.
- Live followers never claim ownership or invent elapsed work. Expiry/runtime gaps preserve the session and require recovery; explicit recovery remains F03.
- Verification: 74 unit tests pass; lint, typecheck and build pass. 11 browser tests passed before the final evidence-validation and channel-fallback hardening; permission for their final rerun was declined.
- Next: F02.6 — visible tracking controls, elapsed display and basic session history. F02 remains in progress. No commit or push performed.


### F02.6 — Timer and basic history UI implemented

- Task cards expose Start or Resume when idle and Switch while another task runs. Current-session controls offer Pause and Done; archive is disabled for the open-session task. Actions report success only after the engine transaction commits.
- A subscribed current-session card shows monotonic elapsed time refreshed once per second while visible. Followers show read-only state with unavailable elapsed; recovery preserves the interval and shows start, checkpoint and user-confirmation evidence separately.
- Read-only session history includes task names, start/end timestamps with stored timezone, end reason, correction flag and ended duration. Overall/per-task totals exclude open intervals and paused gaps. History is reloaded on session transitions and tracking refresh; failed loads suppress totals and offer retry.
- Empty/loading/error states, semantic timer/status regions, keyboard controls and a 375px responsive layout are implemented. Recovery actions and confirmation prompts are explicitly deferred to F03/F04.
- Verification: 76 unit tests; 17 browser tests covering complete UI transitions, persistence after reload, live elapsed, read-only followers, failed Pause, expired ownership messaging and mobile overflow. Lint, typecheck and build pass; mobile screenshot visually reviewed.
- Next: F02.7 — overall feature acceptance and tracker update. F02 remains in progress pending that step. No commit or push performed.

### Accumulated hours update

- Replaced task progress percentages with a previously worked hours starting balance. Total hours include ended sessions and known live elapsed time. Editing the balance preserves session history.
- V3 migration removes legacy task progress and defaults previous hours to zero, preserving task lifecycle and session data.
- Two presence triggers (periodic regardless of activity and inactivity) and shared grace behavior remain under discussion; reminder automation is not implemented.

### Presence prompts and alerts — 2026-10-04

Implemented the user-requested prompt slice ahead of full F03 recovery. F04/F06 remain partial until recovery integration and overall acceptance are completed.

- Periodic and app-inactivity schedules share one persisted prompt and grace deadline. Unanswered or declined prompts end at the captured last activity/confirmation cutoff, excluding the entire inactivity/grace interval.
- Transactional prompt creation/answer handling checks session, owner, generation, prompt identity and grace; late Yes is timeout. Failed writes preserve open session/prompt for retry. Checkpoints remain runtime evidence, not activity.
- Owner-only modal, countdown, Yes/Pause controls, permission-based system notifications, and optional audio chime with enable/test/mute. Denied notifications retain the popup. No forced overlay or device-wide activity detection.
- Ordinary background execution is observed; suspension, reload and clock/lease uncertainty keep the existing recovery behavior instead of fabricating delivery or work. Recovery actions remain outstanding.
- Validation: 82 unit tests and 24 browser tests pass, including timeout cutoffs, periodic checks with activity, stale/foreign answers, failed saves, suspension, duplicate-tab alerts, blocked notifications and sound controls. OS delivery is simulated in browser tests; real banners and audibility depend on browser/OS permissions. Mobile popup rendered and visually inspected. Typecheck, build and lint pass.

### Chime playback repair — 2026-10-04

Replaced the short, quiet oscillator with a bundled 1.8-second two-note WAV played through HTML audio at 80% volume. Playback requests are awaited and errors are shown; Enable/Test playback runs from a user gesture, and Mute stops active playback. UI distinguishes playback starting from confirmed audibility and points to tab/output volume when playback succeeds but cannot be heard. Verified 85 unit tests plus six presence browser tests using the installed Brave executable in an isolated test profile; successful tests inspect native media playback state/source, and denied playback stays off with a visible error. Physical speaker audibility and the user’s existing Brave permissions are outside those automated checks. Build/typecheck/lint pass.

### Refresh tracking and recovery controls — 2026-10-04

- Refresh tracking remains reconciliation/history reload, with visible refreshing state and explanation. It does not reset the timer or silently restart a session.
- Added recovery-only engine command and transactional suggested/custom end or discard. End time is validated against start, current clock, and overlaps. Recovery records are marked corrected; owner/recovery cleanup commits with the session update/delete.
- Protects live foreign owners, compares the expected owner/generation/checkpoint and session revision, and rejects stale recovery. Reloaded sessions may remain followers until the one-minute ownership lease expires. Missing evidence falls back to session start, not invented work.
- UI displays activity/confirmation and runtime checkpoint separately, proposed duration, a local-time end input, and inline discard confirmation. Recovery leaves tracking idle for explicit Start/Resume.
- Build/typecheck and lint passed. No automated tests were added or run in this slice, per user preference. Runtime acceptance awaits the user's manual feedback; existing test expectations/documented assertions may need later updates when automated testing resumes.
