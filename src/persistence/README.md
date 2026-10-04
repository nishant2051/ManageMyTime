# persistence

AppDatabase upgrades V1 to V2 without rewriting tasks. Task repositories await committed transactions and guard edits by revision. IndexedDBSessionReader loads coherent open-session/marker/recovery state; IndexedDBSessionHistory reads validated records newest first without modifying history.

IndexedDBSessionCommands implements atomic Start/Pause/Resume/Complete/Switch and owner checkpoints. Transactions validate task eligibility, ownership, leases, identity/generation and global overlap. TaskService completion routes through the engine; direct repository lifecycle updates still refuse removal of running tasks. Recovery remains F03.
