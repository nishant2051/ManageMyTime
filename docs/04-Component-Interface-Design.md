# 04 — Web Component Interface Design

**Status:** Active web MVP design contract

**Revised:** 2026-10-04 (Asia/Kolkata)

**Scope:** Web application only.

## Ownership

| Component | Responsibility |
| --- | --- |
| Composition root | Construct services, repositories, clocks and browser adapters. |
| TaskService | Validate/create/edit/complete/archive tasks; coordinate running-task changes with engine. |
| SessionEngine | Sole owner of tracking commands, transitions, boundary selection and prompt response validation. |
| UnitOfWork / repository transaction | Atomically read/check/write related records; protect cross-tab invariants. |
| Clock | Injectable wall time and monotonic runtime time; test clock allows deterministic scenarios. |
| RuntimeLifecycleAdapter | Page visibility/liveness signals, startup/reload; never claims actual OS sleep or lock. |
| OwnershipCoordinator | Cross-tab leases/locks, generation and conflict handling; database guard is authoritative. |
| PromptCoordinator | One current in-app prompt, arbitration and display; does not persist session history. |
| PlannerScheduler | Reconcile due blocks from wall timestamps and propose explicit choices. |
| TimelineQueryService | Assemble actual/planned intervals and unknown gaps without inferred labels. |
| AnalyticsQueryService | Derive totals/statistics with calendar-range clipping. |
| ExportService | Stable versioned JSON and safe CSV from repository snapshots. |
| Presentation controllers/hooks | Observe committed snapshots and send commands; no direct record mutation. |

## Interface requirements

Use TypeScript DTOs/value types, not React components or IndexedDB request objects, across application boundaries. Repository operations expose promises whose success means transaction committed. Multi-record changes use one transaction API; separate successful repository calls do not imply atomicity.

Commands: Start(taskId), Pause(sessionId), Resume(taskId), Switch(sessionId, taskId), Complete(taskId), ResolveRecovery(sessionId, resolution), Respond(promptId, sessionId, generation, action). Commands return committed state or typed errors. Inject services for tests.

Observations: runtimeGap, visibilityChanged, ownershipLost, persistenceUnavailable, plannerBoundary and clockDiscontinuity. Browser adapters supply minimal timing/capability facts; none may create sessions or assume page blur means stopped work.

State subscriptions return immutable snapshots plus revision. Other tabs reconcile from durable records on notification, focus and startup. Stale revisions/prompts/generations cannot rewrite current history. Teardown unsubscribes listeners; component remount must not duplicate timers or engine instances.

Errors distinguish validation, conflict/stale event, recoveryRequired, storageUnavailable/quota, migrationBlocked and unexpected failures. Surface actionable messages; preserve the previous committed state on failure. No automatic switch to volatile storage while claiming history is saved.

## Test contracts

Domain/engine tests use fake clocks/repositories. Browser integration tests exercise actual IndexedDB commit/abort, concurrent tabs, owner death, reload, upgrades and storage failures. Prompt tests cover stale responses and planner collisions. Query tests cover corrected records, cross-midnight and DST ranges. UI checks include keyboard navigation and accurate capability/error messages.

No native adapter is required by the web MVP.

## F02.2 implementation baseline

SessionEngine is constructed in the app composition root with BrowserClock and IndexedDBSessionReader. It explicitly reconciles committed session evidence, serializes dispatch/observations, exposes immutable subscription snapshots and rejects unsupported production commands. SessionCommandHandler defines the transaction-commit boundary; the production writer follows in F02.3. Runtime timing thresholds are recorded in [Decision 001](decisions/001-runtime-clock-foundation.md). The engine contains no timer intervals or lifecycle listeners yet.

## F02.3 implementation baseline

The composition root now injects IndexedDBSessionCommands into SessionEngine. Start/Pause/Resume resolve only after the combined tasks/session/marker/recovery transaction commits. Domain-safe typed errors preserve conflict/stale-action classification through the engine. TaskService completion in the production composition dispatches Complete through the engine with expected task revision and session identity/generation. Switch uses the same transaction scope. Direct repository lifecycle updates still refuse changes to running tasks; archive requires pausing first. A disposable browser coordinator reconciles committed change hints, polls every 15 seconds and dispatches owner checkpoints for a healthy running engine. F02.6 subscribes the Tasks UI to committed session snapshots, observes monotonic elapsed once per second and reads validated history. Start/Resume/Switch and Pause/Done route through the engine; recovery actions remain F03.
