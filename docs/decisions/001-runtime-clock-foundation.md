# Decision 001 — Runtime clock foundation

**Date:** 2026-10-04 (Asia/Kolkata)

**Status:** Clock foundation implemented in F02.2; ownership scheduling implemented in F02.5.

Use an injectable clock sample with UTC wall time (`Date.now`) and runtime-local monotonic time (`performance.now`). Wall time supplies historical command boundaries; monotonic elapsed is derived from an anchor captured for a newly committed session in this runtime. Never persist or reconstruct monotonic anchors across reloads.

The initial engine uncertainty thresholds are a maximum 60,000ms gap between observations and 2,000ms tolerance for wall/monotonic drift. Check drift both since the last observation and since the session anchor so small cumulative changes are detected. A monotonic reversal is also uncertain. These values detect unreliable runtime timing; they do not represent inactivity or productivity. Both are injectable, validated and copied by the engine so callers cannot mutate a running policy.

A gap/discontinuity clears the live anchor and returns recoveryRequired with unknown elapsed duration. It neither closes nor rewrites a persisted session. Subsequent observations cannot automatically restore trust. Existing open sessions without a runtime anchor require reconciliation; a marker for another owner with an unexpired lease is followed without inventing elapsed work or claiming an orphaned session.

The engine itself creates no intervals or browser listeners. F02.5 mounts a disposable app coordinator that reconciles every 15 seconds while visible and checkpoints healthy running sessions. Each checkpoint atomically renews a 60-second lease and updates recovery evidence, without advancing lastUserConfirmedAt. Visibility, focus and page restoration reconcile immediately. Hidden tabs skip scheduled renewal; suspension/throttling may expire ownership and require explicit recovery.

BroadcastChannel carries only committed-change hints; recipients read IndexedDB. Polling supports unavailable/restricted channels. Followers never renew foreign ownership or invent elapsed work. Disposal removes intervals/listeners and closes the channel. No background-execution guarantee is assumed.

Transaction guards enforce owner, session identity, generation and unexpired leases. Expiry does not allow automatic takeover or closing history. F03 supplies explicit recovery actions. Failed renewal preserves lease and evidence. Validate throttling on the supported browser matrix before release.

Acceptance evidence: deterministic engine tests cover queued delayed commits, failed saves, listener failures, snapshots/queued input, monotonic elapsed, runtime gaps, clock jumps, foreign ownership and restart uncertainty. Real-browser task/migration regression checks remain unchanged.
