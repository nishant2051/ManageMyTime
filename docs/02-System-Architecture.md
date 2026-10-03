# 02 — Web System Architecture

**Status:** Active web MVP design contract

**Revised:** 2026-10-04 (Asia/Kolkata)

**Scope:** Web application only.

## Decisions

| Area | Web MVP decision |
| --- | --- |
| Runtime | Browser application; React + TypeScript + Vite |
| Backend | None; single browser profile/origin |
| Persistence | Versioned IndexedDB database; typed repositories |
| Preferences | IndexedDB settings store for consistent export/reset semantics |
| Domain | Framework-independent TypeScript models and policies |
| Session ownership | SessionEngine serializes commands; database transaction enforces global invariant |
| Multi-tab | Web Locks where supported; transactional IndexedDB guard remains authoritative; BroadcastChannel or database reconciliation updates other tabs |
| Time | UTC wall timestamps for records; injected monotonic clock for contiguous live runtime |
| Prompts | In-app coordinator; no closed-tab notification guarantee |
| Offline | Cache versioned app shell using a service worker; HTTPS or localhost |
| Deployment | Static web hosting; provider chosen during deployment, no automatic upload of user data |

## Layers and dependency direction

Presentation → Application → Domain. Persistence and browser adapters implement domain/application interfaces. Composition root wires dependencies. Views never independently mutate session records. React state is a projection of committed data, not session truth.

Planned source folders: `src/app`, `src/presentation`, `src/application`, `src/domain`, `src/infrastructure`, `src/persistence`. These are proposed paths, not implemented code.

## Integrity

Start, Pause, Switch, Complete and recovery resolution use explicit IndexedDB transactions covering sessions, active marker, task lifecycle and recovery records as needed. Await transaction completion before publishing success. Never await unrelated network/UI work inside an IndexedDB transaction. Event-loop serialization alone does not protect against another tab.

Do not depend on timer tick counts. Recompute display values from captured clocks/boundaries. Process due events in the engine and validate session/prompt/generation identities. Prompt arbitration does not own recorded history.

## Browser lifecycle

Visibility changes provide page visibility only. Switching tabs leaves explicit manual tracking running. A visible or hidden page may be suspended; tab closure does not guarantee a final write, and service workers cannot provide a continuously running timer.

Maintain runtime checkpoints and distinguish runtime liveness from user-confirmed work. Reopening an orphaned session or detecting an unexplained gap enters recovery before normal tracking. Do not mark sleep/lock as directly observed. Document 05 defines countable boundaries and confirmation timing.

## Platform validation before release

Probe IndexedDB transactions/migrations/quota failures, ownership across simultaneous tabs, notification-free in-app prompts, throttled/suspended runtime, reload/crash recovery, calendar/DST behavior and offline service-worker updates. Run on the supported browser matrix. Local data belongs to an origin: changing host/port/profile changes which database is visible.

## Build and verification

Scaffold first: development server, production build, type check, lint and smoke launch. Later add deterministic engine tests, repository tests in real browsers, multi-tab race tests and feature UI tests. Migration and lifecycle tests are required before release.

## Browser reference material

- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API): page visibility signals and background timer throttling.
- [Idle Detection API](https://developer.mozilla.org/en-US/docs/Web/API/Idle_Detection_API): limited-support optional capability, excluded from MVP.
- [Browser storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria): retention limits and persistent-storage requests.
- [Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB): origin-scoped data and transaction behavior.
