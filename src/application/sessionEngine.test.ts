import { describe, expect, it } from 'vitest'
import { SessionEngine, SessionEngineError } from './sessionEngine'
import type { Clock, ClockSample } from '../domain/clock'
import type { SessionCommand, SessionCommandContext, SessionRecords } from '../domain/sessionStore'

class TestClock implements Clock {
  wallTime = 1000
  monotonicTime = 100
  sample() { return {wallTime:this.wallTime, monotonicTime:this.monotonicTime} }
  advance(milliseconds: number) { this.wallTime += milliseconds; this.monotonicTime += milliseconds }
}
const idle: SessionRecords = {session:null, active:null, recovery:null}
function running(context: SessionCommandContext, id = 'session-1'): SessionRecords {
  const start = context.clock.wallTime
  return {
    session:{id, taskId:'task-1', startedAt:start, endedAt:null, creationSource:'tracked', wasCorrected:false,
      endReason:null, timezone:'UTC', createdAt:start, updatedAt:start, revision:1},
    active:{key:'active', sessionId:id, ownerId:context.ownerId, generation:1, leaseExpiresAt:start+120_000, lastRuntimeCheckpointAt:start},
    recovery:{key:'active', sessionId:id, lastRuntimeCheckpointAt:start, lastUserConfirmedAt:start, pendingConfirmation:null},
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes,no) => {resolve=yes; reject=no})
  return {promise,resolve,reject}
}
function setup(commit?: (command: SessionCommand, context: SessionCommandContext) => Promise<SessionRecords>) {
  const clock = new TestClock()
  const records = {current:idle}
  const engine = new SessionEngine({read:async () => structuredClone(records.current)},clock,'owner-1',commit ? {commit} : undefined)
  return {engine,clock,records}
}
const start: SessionCommand = {type:'start',taskId:'task-1'}
describe('session engine foundation', () => {
  it('starts uninitialized and reads committed idle state explicitly', async () => {
    const {engine} = setup()
    expect(engine.getSnapshot().mode).toBe('uninitialized')
    const state = await engine.reconcile()
    expect(state).toMatchObject({revision:1,mode:'idle',elapsedMilliseconds:null})
    await expect(engine.dispatch(start)).rejects.toMatchObject({code:'commandUnavailable'})
  })
  it('publishes only after commit and serializes waiting commands', async () => {
    const first = deferred<SessionRecords>()
    const calls: SessionCommand[] = []
    let context!: SessionCommandContext
    const {engine} = setup(async (command,ctx) => {
      calls.push(command); context=ctx
      return calls.length===1 ? first.promise : idle
    })
    await engine.reconcile()
    let notifications = 0
    engine.subscribe(() => {notifications++})
    const initial = engine.getSnapshot()
    const creating = engine.dispatch(start)
    const pausing = engine.dispatch({type:'pause',sessionId:'session-1',generation:1})
    await Promise.resolve(); await Promise.resolve()
    expect(calls).toHaveLength(1)
    expect(engine.getSnapshot()).toBe(initial)
    expect(notifications).toBe(0)
    first.resolve(running(context))
    expect((await creating).mode).toBe('running')
    expect((await pausing).mode).toBe('idle')
    expect(calls).toHaveLength(2)
    expect(notifications).toBe(2)
  })
  it('does not publish failed saves and continues processing after rejection', async () => {
    let attempt = 0
    const {engine} = setup(async (_command,context) => {
      if (++attempt===1) throw new Error('Transaction aborted')
      return running(context)
    })
    await engine.reconcile(); const before = engine.getSnapshot()
    await expect(engine.dispatch(start)).rejects.toMatchObject({code:'storageUnavailable'})
    expect(engine.getSnapshot()).toBe(before)
    expect((await engine.dispatch(start)).mode).toBe('running')
  })
  it('isolates subscriber errors and supports unsubscribe', async () => {
    const {engine} = setup(async (_command,context) => running(context))
    engine.subscribe(() => {throw new Error('Broken presentation observer')})
    let calls=0; const remove=engine.subscribe(() => {calls++})
    await engine.reconcile(); remove()
    await engine.dispatch(start)
    expect(calls).toBe(1)
  })
  it('protects snapshots and queued command input from mutation', async () => {
    let capturedTask = ''
    const {engine} = setup(async (command,context) => {
      if (command.type === 'start') capturedTask = command.taskId
      return running(context)
    })
    await engine.reconcile()
    const command = {type:'start' as const,taskId:'task-1'}
    const result = engine.dispatch(command)
    command.taskId = 'changed'
    const snapshot = await result
    expect(capturedTask).toBe('task-1')
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.records.session)).toBe(true)
    expect(Object.isFrozen(snapshot.records.recovery)).toBe(true)
  })
  it('derives elapsed from monotonic samples, with no tick accumulator', async () => {
    const {engine,clock} = setup(async (_command,context) => running(context))
    await engine.reconcile(); await engine.dispatch(start)
    clock.advance(1500)
    expect((await engine.observeClock()).elapsedMilliseconds).toBe(1500)
    clock.advance(2500)
    expect((await engine.observeClock()).elapsedMilliseconds).toBe(4000)
  })
  it.each([60_001, 180_000])('does not count an unexplained %s ms runtime gap', async gap => {
    const {engine,clock} = setup(async (_command,context) => running(context))
    await engine.reconcile(); await engine.dispatch(start); clock.advance(gap)
    expect(await engine.observeClock()).toMatchObject({mode:'recoveryRequired',uncertainty:'runtimeGap',elapsedMilliseconds:null})
    expect((await engine.observeClock()).uncertainty).toBe('runtimeGap')
    await expect(engine.dispatch({type:'pause',sessionId:'session-1',generation:1})).rejects.toMatchObject({code:'recoveryRequired'})
  })
  it.each([-5000, 5000])('detects a wall clock jump of %s ms', async jump => {
    const {engine,clock} = setup(async (_command,context) => running(context))
    clock.wallTime = 100_000
    await engine.reconcile(); await engine.dispatch(start)
    clock.wallTime += jump
    expect(await engine.observeClock()).toMatchObject({mode:'recoveryRequired',uncertainty:'clockDiscontinuity',elapsedMilliseconds:null})
  })
  it('preflights clock uncertainty before any persistence mutation', async () => {
    let calls=0
    const {engine,clock} = setup(async (_command,context) => {calls++; return running(context)})
    await engine.reconcile(); await engine.dispatch(start); clock.advance(90_000)
    await expect(engine.dispatch({type:'pause',sessionId:'session-1',generation:1})).rejects.toMatchObject({code:'recoveryRequired'})
    expect(calls).toBe(1)
  })
  it('does not reconstruct elapsed from an existing open session on reload', async () => {
    const {engine,clock,records} = setup()
    records.current = running({clock:clock.sample(),ownerId:'owner-1'})
    clock.advance(5000)
    expect(await engine.reconcile()).toMatchObject({mode:'recoveryRequired',elapsedMilliseconds:null,uncertainty:'interruptedRuntime'})
  })
  it('follows another live owner rather than claiming a running or interrupted session', async () => {
    const {engine,clock,records} = setup()
    records.current = running({clock:clock.sample(),ownerId:'other-owner'})
    expect(await engine.reconcile()).toMatchObject({mode:'following',elapsedMilliseconds:null})
    clock.advance(120_001)
    expect((await engine.reconcile()).mode).toBe('recoveryRequired')
  })
  it('preserves committed state after read failures and rejects mismatched marker evidence', async () => {
    let fail=false
    const clock=new TestClock()
    const engine=new SessionEngine({read:async () => {
      if (fail) throw new Error('Storage offline')
      return idle
    }},clock,'owner')
    await engine.reconcile(); const prior=engine.getSnapshot(); fail=true
    await expect(engine.reconcile()).rejects.toMatchObject({code:'storageUnavailable'})
    expect(engine.getSnapshot()).toBe(prior)
    const invalid=running({clock:clock.sample(),ownerId:'owner'})
    invalid.active!.sessionId='wrong'
    const bad=new SessionEngine({read:async () => invalid},clock,'owner')
    await expect(bad.reconcile()).rejects.toMatchObject({code:'invalidState'})
  })
  it('rejects invalid clocks without publishing changes', async () => {
    const badClock: Clock = {sample:():ClockSample => ({wallTime:NaN,monotonicTime:0})}
    const engine=new SessionEngine({read:async () => idle},badClock,'owner')
    await expect(engine.reconcile()).rejects.toBeInstanceOf(SessionEngineError)
    expect(engine.getSnapshot().mode).toBe('uninitialized')
  })
})
