import type { Clock, ClockSample } from '../domain/clock'
import type { SessionCommand, SessionCommandHandler, SessionReader, SessionRecords } from '../domain/sessionStore'
import { validateWorkSession } from '../domain/workSession'

import { SessionEngineError } from '../domain/sessionError'
export { SessionEngineError } from '../domain/sessionError'
export type { SessionEngineErrorCode } from '../domain/sessionError'

export type EngineMode = 'uninitialized' | 'idle' | 'running' | 'following' | 'recoveryRequired'
type DeepReadonly<T> = T extends object ? {readonly [K in keyof T]: DeepReadonly<T[K]>} : T
export interface SessionSnapshot {
  readonly revision: number
  readonly mode: EngineMode
  readonly records: DeepReadonly<SessionRecords>
  readonly elapsedMilliseconds: number | null
  readonly uncertainty: 'interruptedRuntime' | 'runtimeGap' | 'clockDiscontinuity'  | null
}
export interface RuntimeTimingPolicy {
  readonly maximumObservationGapMilliseconds: number
  readonly clockDriftToleranceMilliseconds: number
}
export const defaultRuntimeTimingPolicy: RuntimeTimingPolicy = {
  maximumObservationGapMilliseconds: 60_000,
  clockDriftToleranceMilliseconds: 2_000,
}
interface Anchor {
  readonly sessionId: string
  readonly generation: number
  readonly start: ClockSample
  last: ClockSample
}

function immutable<T>(value: T): T {
  const copy = structuredClone(value)
  function freeze(item: unknown) {
    if (item !== null && typeof item === 'object') {
      Object.values(item).forEach(freeze)
      Object.freeze(item)
    }
  }
  freeze(copy)
  return copy
}

/** Runtime command queue. Cross-tab safety must also be enforced by commit(). */
export class SessionEngine {
  private queue: Promise<void> = Promise.resolve()
  private listeners = new Set<() => void>()
  private committedListeners = new Set<() => void>()
  private anchor: Anchor | null = null
  private readonly policy: RuntimeTimingPolicy
  private state: SessionSnapshot = immutable({ revision: 0, mode: 'uninitialized',
    records: {session:null, active:null, recovery:null}, elapsedMilliseconds:null, uncertainty:null })

  constructor(
    private readonly reader: SessionReader,
    private readonly clock: Clock,
    private readonly ownerId: string,
    private readonly commands?: SessionCommandHandler,
    policy: RuntimeTimingPolicy = defaultRuntimeTimingPolicy,
  ) {
    if (!ownerId.trim()) throw new Error('A runtime owner identity is required.')
    if (!Number.isFinite(policy.maximumObservationGapMilliseconds) || policy.maximumObservationGapMilliseconds <= 0 ||
      !Number.isFinite(policy.clockDriftToleranceMilliseconds) || policy.clockDriftToleranceMilliseconds < 0) {
      throw new Error('Invalid runtime timing policy.')
    }
    this.policy = immutable(policy)
  }

  getSnapshot = (): SessionSnapshot => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  subscribeCommitted(listener: () => void): () => void {
    this.committedListeners.add(listener)
    return () => { this.committedListeners.delete(listener) }
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work)
    // A rejected operation must not poison subsequent commands or reads.
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }
  private sample(): ClockSample {
    const value = this.clock.sample()
    if (!Number.isSafeInteger(value.wallTime) || value.wallTime < 0 || !Number.isFinite(value.monotonicTime) || value.monotonicTime < 0) {
      throw new SessionEngineError('invalidClock', 'The current runtime clock is invalid.')
    }
    return immutable(value)
  }
  private publish(next: Omit<SessionSnapshot, 'revision'>): SessionSnapshot {
    this.state = immutable({ ...next, revision: this.state.revision + 1 })
    // Subscriber failures do not turn a committed operation into a failed save.
    for (const listener of [...this.listeners]) {
      try { listener() } catch { /* Observers are isolated from engine integrity. */ }
    }
    return this.state
  }
  private validate(records: SessionRecords) {
    if (records.session) {
      validateWorkSession(records.session)
      if (records.session.endedAt !== null) throw new SessionEngineError('invalidState', 'An active view cannot contain an ended session.')
    }
    if (records.active && (!records.active.ownerId.trim() || !Number.isSafeInteger(records.active.generation) ||
        records.active.generation < 1 || !Number.isSafeInteger(records.active.leaseExpiresAt) ||
        !Number.isSafeInteger(records.active.lastRuntimeCheckpointAt))) {
      throw new SessionEngineError('invalidState', 'Invalid active-session ownership evidence.')
    }
    if (records.active && records.active.sessionId !== records.session?.id) {
      throw new SessionEngineError('invalidState', 'The active marker does not match the open session.')
    }
    if (records.recovery && records.recovery.sessionId !== records.session?.id) {
      throw new SessionEngineError('invalidState', 'Recovery evidence does not match the open session.')
    }
  }
  private view(records: SessionRecords, sample: ClockSample): Omit<SessionSnapshot, 'revision'> {
    if (!records.session) {
      this.anchor = null
      return {mode:'idle', records, elapsedMilliseconds:null, uncertainty:null}
    }
    const marker = records.active
    if (marker && marker.ownerId !== this.ownerId && marker.leaseExpiresAt > sample.wallTime) {
      this.anchor = null
      return {mode:'following', records, elapsedMilliseconds:null, uncertainty:null}
    }
    if (!this.anchor || marker?.ownerId !== this.ownerId || this.anchor.sessionId !== records.session.id || this.anchor.generation !== marker.generation) {
      this.anchor = null
      return {mode:'recoveryRequired', records, elapsedMilliseconds:null, uncertainty: this.state.mode === 'recoveryRequired' && this.state.records.session?.id === records.session.id
        ? this.state.uncertainty : 'interruptedRuntime'}
    }
    const monoDelta = sample.monotonicTime - this.anchor.last.monotonicTime
    const wallDelta = sample.wallTime - this.anchor.last.wallTime
    const anchorDrift = (sample.wallTime - this.anchor.start.wallTime) - (sample.monotonicTime - this.anchor.start.monotonicTime)
    if (monoDelta < 0 || Math.abs(wallDelta - monoDelta) > this.policy.clockDriftToleranceMilliseconds ||
        Math.abs(anchorDrift) > this.policy.clockDriftToleranceMilliseconds) {
      this.anchor = null
      return {mode:'recoveryRequired', records, elapsedMilliseconds:null, uncertainty:'clockDiscontinuity'}
    }
    if (Math.max(monoDelta, wallDelta) > this.policy.maximumObservationGapMilliseconds) {
      this.anchor = null
      return {mode:'recoveryRequired', records, elapsedMilliseconds:null, uncertainty:'runtimeGap'}
    }
    if (marker && marker.leaseExpiresAt <= sample.wallTime) {
      this.anchor = null
      return {mode:'recoveryRequired',records,elapsedMilliseconds:null,uncertainty:'interruptedRuntime'}
    }
    this.anchor.last = sample
    return {mode:'running', records, elapsedMilliseconds: sample.monotonicTime - this.anchor.start.monotonicTime, uncertainty:null}
  }

  /** Explicit startup/reconciliation; reopening never reconstructs a live anchor. */
  reconcile(): Promise<SessionSnapshot> {
    return this.serial(async () => {
      let records: SessionRecords
      try { records = await this.reader.read() }
      catch (cause) { throw new SessionEngineError('storageUnavailable', 'Session state could not be loaded.', {cause}) }
      const now = this.sample()
      this.validate(records)
      return this.publish(this.view(records, now))
    })
  }

  dispatch(command: SessionCommand): Promise<SessionSnapshot> {
    // Capture caller input so a queued command cannot be changed while waiting.
    const captured = immutable(command)
    return this.serial(async () => {
      if (!this.commands) throw new SessionEngineError('commandUnavailable', 'Session actions will be enabled in the next tracking step.')
      if (this.state.mode === 'uninitialized') throw new SessionEngineError('invalidState', 'Load session state before issuing a command.')
      if (this.state.mode === 'recoveryRequired') throw new SessionEngineError('recoveryRequired', 'Resolve the interrupted session before tracking again.')
      const now = this.sample()
      if (this.state.mode === 'running') {
        const current = this.view(this.state.records, now)
        if (current.mode === 'recoveryRequired') {
          this.publish(current)
          throw new SessionEngineError('recoveryRequired', 'Resolve uncertain timing before changing this session.')
        }
      }
      let records: SessionRecords
      try { records = await this.commands.commit(captured, {clock:now, ownerId:this.ownerId}) }
      catch (cause) {
        if (cause instanceof SessionEngineError) throw cause
        throw new SessionEngineError('storageUnavailable', 'Session changes were not saved.', {cause})
      }
      this.validate(records)
      // Only a newly started session owned by this runtime can establish an anchor.
      if (records.session && records.session.id !== this.state.records.session?.id &&
          records.active?.ownerId === this.ownerId && records.session.startedAt === now.wallTime) {
        this.anchor = {sessionId:records.session.id, generation:records.active.generation, start:now, last:now}
      }
      const snapshot = this.publish(this.view(records, this.sample()))
      for (const listener of [...this.committedListeners]) {
        try { listener() } catch { /* Notifications cannot undo a committed save. */ }
      }
      return snapshot
    })
  }

  /** Caller-driven observation: no hidden intervals, timers or browser listeners. */
  observeClock(): Promise<SessionSnapshot> {
    return this.serial(async () => {
      if (this.state.mode === 'uninitialized' || this.state.mode === 'idle') return this.state
      return this.publish(this.view(this.state.records, this.sample()))
    })
  }
}
