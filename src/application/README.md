# application

TaskService coordinates validated task lifecycle operations. SessionEngine serializes tracking command/read/clock observation requests, publishes committed immutable snapshots and conservatively handles timing uncertainty. The production adapter now supports Start/Pause/Resume. Complete/Switch and UI integration remain subsequent steps.
