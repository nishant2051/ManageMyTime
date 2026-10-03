# 03 — Web Persistence Design

**Status:** Active web MVP design contract

**Revised:** 2026-10-04 (Asia/Kolkata)

**Scope:** Web application only.

## Storage contract

Use IndexedDB with schema version 1 and typed repository adapters. Keep business records in IndexedDB rather than localStorage. Request persistent storage when appropriate, handle refusal honestly, and explain that clearing site data/private browsing/browser eviction can affect records. Persistence is local to one origin/profile, not synchronization or a server backup.

## Stores

| Store | Key / fields | Rules |
| --- | --- | --- |
| tasks | UUID; name, type, status, revision, notes, optional progressPercent, confirmation policy, createdAt/updatedAt/completedAt/archivedAt | Trimmed name 1–200 characters; duplicate names allowed; progress 0–100; completed tasks do not restart. |
| workSessions | UUID; taskId, startedAt, endedAt nullable, creationSource, wasCorrected, endReason, timezone, createdAt/updatedAt | Required task; nonnegative ended interval; no overlapping sessions globally; at most one open session. |
| activeSession | Singleton key; sessionId, ownerId, generation, owner lease/checkpoint | Transactional guard; owner lease indicates liveness, never proven work. |
| recovery | Singleton key; sessionId, lastRuntimeCheckpointAt, lastUserConfirmedAt, pendingPrompt boundary/context | Resolve orphaned sessions without inventing time; remove after committed resolution. |
| timeBlocks | UUID; taskId nullable, blockType task/break, start/end, timezone, createdAt/updatedAt | End after start; task blocks require task; breaks do not; no planned/actual coupling. Reject overlapping planned blocks in MVP. |
| todos | UUID; localDate YYYY-MM-DD, title, completion, notes, optional progress/estimate/deadline/taskId, timestamps | Flat todos; valid calendar date; positive estimate when supplied; optional link. |
| settings | Stable key; defaults and UI preferences | New defaults affect new tasks only; include in reset and JSON export. |

Use epoch milliseconds for timestamp storage and ISO-8601 UTC in exports. Store relevant IANA timezone context; date-only todos are not midnight UTC timestamps. Lifecycle running/paused display derives from sessions; persistent task status is ready/completed/archived. End reasons include userPaused, taskCompleted, taskSwitched, confirmationTimeout, interruptedRecovery and manual. Do not persist unavailable systemSleep/screenLock observations.

ApplicationAssociation and raw activity/event stores are excluded. Creation source distinguishes tracked/manual; corrected flag preserves correction provenance without a full audit-history table.

## Transactions and relationships

IndexedDB has no relational foreign keys: validate links and implement cascade/nullify in repository transactions. Start checks task eligibility and active marker in the same transaction that inserts the session. Switch closes old session and creates new at a shared explicit boundary atomically. Complete closes the active session if applicable and updates task lifecycle. Guard every terminal mutation by session identity and expected state.

Normal removal archives. Confirmed permanent task deletion cascades sessions, clears associated recovery/active marker and nullifies todo/time-block links. Preserve a removed task block's label and render its broken assignment explicitly; it cannot trigger a switch. Running-task deletion must first resolve its active interval within the same validated operation.

Manual corrections are restricted to ended sessions; validate overlap against all other sessions, including an active session. Treat intervals as half-open [start, end), allowing touching boundaries. No negative/future interval beyond correction policy; validate timezone/calendar inputs separately.

## Queries and migration

Index task lifecycle, session taskId/startedAt, block start and todo localDate. Query sessions intersecting a range, including those starting before it; clip durations to local calendar boundaries for analytics. Never use a fixed 24-hour assumption for DST days.

Schema upgrades run in version-change transactions. Test old-schema fixtures, handle blocked upgrades from other tabs, preserve data on error, and never silently recreate an empty database after failure.

## Exports and reset

JSON: exportVersion, exportedAt, tasks, workSessions, timeBlocks, todos and settings. Include interrupted/open sessions with explicit state; do not export ephemeral owner tokens as portable business data. Stable DTOs are independent of IndexedDB internals. CSV columns: session_id, task_id, task_name, started_at, ended_at, timezone, duration_seconds, creation_source, was_corrected, end_reason. Escape CSV cells safely, including formula-like values.

Exports require a user action; no automatic uploads. Confirm permanent deletion/reset and show affected history. Reset removes business stores, recovery and preferences consistently and informs other open tabs. Import/restore and automated backup are deferred.

## F01 implementation baseline

Schema V1 currently creates only the tasks store and its status index. Other stores above are planned; add them with explicit version upgrades in their feature slices. Task revisions increment on committed changes and prevent stale overwrites. Task defaults are currently supplied by the composition/service layer; a user-editable persisted defaults surface is F13.
