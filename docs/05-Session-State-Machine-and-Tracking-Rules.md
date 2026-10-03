# 05 — Web Session State Machine and Tracking Rules

**Status:** Active web MVP design contract

**Revised:** 2026-10-04 (Asia/Kolkata)

**Scope:** Web application only.

## States and invariants

States: Idle, Running, AwaitingPeriodicConfirmation, Recovering and StorageUnavailable. Paused means the engine is Idle with a closed prior session; Resume always inserts a new session.

Only one open WorkSession exists across tabs in one database. Engine commands serialize within a tab; IndexedDB transactions enforce invariants across tabs. First committed valid terminal transition wins. Late timer/prompt events cannot change an ended session. Persist before publishing success.

## Transition and boundary contract

| Event | Result | Recorded boundary |
| --- | --- | --- |
| Start/Resume eligible task | Running, new session | Explicit command time |
| Pause | Idle, ended session | Command time, or earlier unresolved prompt boundary |
| Switch | Close old/open new atomically | Command time; earlier uncertainty closes old conservatively and preserves any gap |
| Done | Close session if active, complete task | Command time, or earlier unresolved boundary |
| Confirmation due with available runtime | AwaitingPeriodicConfirmation | Capture due time and session/prompt/generation IDs |
| Yes within grace | Running, same session | User confirms continuity; next interval starts from response |
| No / grace timeout | Idle, ended session | Captured confirmation-due time |
| Prompt deadline already missed during suspension | Recovering | Do not invent a timely delivered prompt or count an expired interval automatically |
| Orphaned open session on startup | Recovering | Last defensible confirmed boundary proposed to user |
| Unexpected runtime gap / clock discontinuity | Recovering | Resolve ambiguity before counting the uncertain interval |
| Page hidden / ordinary tab switch | No terminal transition by itself | Visibility does not establish stopped work |
| Ownership lost to another live tab | Read-only follower/reconcile | Do not end a session merely because UI ownership changed |

## Manual timing and interruption

Manual tracking records the user's explicit choice to keep a session running; it does not claim verified activity. In uninterrupted runtime, use monotonic elapsed time for live display and wall timestamps for history. Checkpoints record runtime liveness, not proof of continued work.

At tracking implementation, define and test a runtime-gap threshold and checkpoint cadence in a decision record. Both are uncertainty-detection parameters, not inactivity thresholds. On ambiguous clock changes, suspension or ownership expiry, reconcile from persisted state and ask whether work continued. Do not silently use Date.now minus start as authoritative actual time across interruptions.

Recovery UI shows task, start time, last user-confirmed boundary and last runtime checkpoint separately. Offer End at suggested time, I worked until a specified time and Discard with explicit confirmation. Validate interval/overlap and commit end/discard plus recovery cleanup atomically. Return to Idle; user Resume creates a new session. Do not auto-resume on reopen.

On startup, a second tab must first check for a live owner; do not recover a session still legitimately owned by another tab. Expired leases are only a reason to reconcile, not evidence that the user stopped work.

Grace deadlines use monotonic time only within contiguous runtime. Persist wall due boundaries/context for recovery. After reload, do not reconstruct a guaranteed running monotonic deadline. Pending confirmation resolution takes precedence over planner suggestions.

## Browser close and offline behavior

Persist important transitions immediately. Pagehide/beforeunload final writes are best effort; correctness must survive their absence. No guarantee of prompt execution while closed, frozen or suspended. Installing the app as a PWA does not remove those limits. Service workers cache the app shell, not a permanent session engine.

Do not infer exact sleep/lock boundaries from a clock gap, and do not promise automatically excluding all sleep time. Ambiguous intervals require user resolution. Manual pause remains the reliable explicit stop action.

## Planner and corrections

Planner events offer Switch, Continue or Break; never automatically change task/session or extend a block. Reconcile missed boundaries on return, avoid a queue of obsolete prompts and do not backdate a user-accepted switch. Corrections affect ended sessions only, preserve corrected provenance and reject global overlaps. Gaps remain unknown unless the user explicitly supplies classification.

## Required tests

Start/Pause/Resume; accumulated multiple sessions; Done and switch transactions; duplicate-tab starts; failed writes/aborted switches; stale response and timer generation; confirmation Yes/No/timeout; overdue prompt after suspension; orphan recovery; live owner in another tab; clock jumps; startup during pending prompt; planner collision; overlap/cross-midnight corrections. Native inactivity/app-mismatch/sleep event tests are deferred with those features.
