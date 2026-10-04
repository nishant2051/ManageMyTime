import { afterEach, expect, it, vi } from 'vitest'
import { SessionCoordinator } from './sessionCoordinator'
import type { SessionEngine } from '../application/sessionEngine'

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()})

it('polls without BroadcastChannel and cleans up timers and lifecycle listeners', async ()=>{
  vi.useFakeTimers()
  const documentTarget=Object.assign(new EventTarget(),{visibilityState:'visible'})
  const windowTarget=Object.assign(new EventTarget(),{setInterval,clearInterval})
  vi.stubGlobal('document',documentTarget);vi.stubGlobal('window',windowTarget);vi.stubGlobal('BroadcastChannel',undefined)
  const reconcile=vi.fn().mockResolvedValue({mode:'idle'})
  const unsubscribe=vi.fn()
  const engine={reconcile,subscribeCommitted:vi.fn(()=>unsubscribe)} as unknown as SessionEngine
  const coordinator=new SessionCoordinator(engine)
  const stop=coordinator.start()
  await coordinator.refresh()
  expect(coordinator.start()).toBe(stop)
  await vi.advanceTimersByTimeAsync(15_000)
  expect(reconcile).toHaveBeenCalledTimes(2)
  documentTarget.visibilityState='hidden'
  await vi.advanceTimersByTimeAsync(15_000)
  expect(reconcile).toHaveBeenCalledTimes(2)
  documentTarget.visibilityState='visible';documentTarget.dispatchEvent(new Event('visibilitychange'))
  await coordinator.refresh()
  expect(reconcile).toHaveBeenCalledTimes(3)
  stop()
  await vi.advanceTimersByTimeAsync(30_000)
  windowTarget.dispatchEvent(new Event('focus'))
  expect(reconcile).toHaveBeenCalledTimes(3)
  expect(unsubscribe).toHaveBeenCalledOnce()
})

it('coalesces refreshes and exposes failures for callers to present', async ()=>{
  let reject!: (error:Error)=>void
  const reconcile=vi.fn(()=>new Promise((_resolve,fail)=>{reject=fail}))
  const coordinator=new SessionCoordinator({reconcile} as unknown as SessionEngine)
  const first=coordinator.refresh()
  expect(coordinator.refresh()).toBe(first)
  const failure=new Error('Storage unavailable')
  reject(failure);await first
  expect(coordinator.getError()).toBe(failure)
  expect(reconcile).toHaveBeenCalledOnce()
})
