# persistence

IndexedDB Schema V1 currently contains the tasks store with a status index. The task adapter awaits transaction completion and guards edits with revisions. Add other stores through schema upgrades as their slices are implemented.
