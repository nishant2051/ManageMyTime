import { describe, expect, it } from 'vitest'
import { completedDurationMilliseconds, sessionsOverlap, validateWorkSession } from './workSession'
import type { WorkSession } from './workSession'

const session: WorkSession = {id: 'session-1', taskId: 'task-1', startedAt: 1000, endedAt: 2000,
  creationSource: 'tracked', wasCorrected: false, endReason: 'userPaused', timezone: 'Asia/Kolkata',
  createdAt: 1000, updatedAt: 2000, revision: 1}
describe('session record contracts', () => {
  it('calculates ended duration and never invents an open duration', () => {
    expect(completedDurationMilliseconds(session)).toBe(1000)
    expect(completedDurationMilliseconds({...session, endedAt: null, endReason: null})).toBeNull()
    expect(completedDurationMilliseconds({...session, endedAt: session.startedAt})).toBe(0)
  })
  it.each([NaN, Infinity, -1, 1.5, 8_640_000_000_000_001])('rejects invalid timestamps %s', startedAt => {
    expect(() => validateWorkSession({...session, startedAt})).toThrow('timestamps')
  })
  it('rejects reversed intervals', () => {
    expect(() => validateWorkSession({...session, endedAt: 999})).toThrow('before')
  })
  it('requires a reason only when the session has ended', () => {
    expect(() => validateWorkSession({...session, endReason: null})).toThrow('end reason')
    expect(() => validateWorkSession({...session, endedAt: null})).toThrow('end reason')
  })
  it('requires bounded manual history and valid task identity/timezone', () => {
    expect(() => validateWorkSession({...session, creationSource:'manual', endedAt:null, endReason:null})).toThrow('Manual')
    expect(() => validateWorkSession({...session, taskId:' '})).toThrow('identities')
    expect(() => validateWorkSession({...session, timezone:'Not/AZone'})).toThrow('timezone')
  })
  it('allows adjacent sessions and ignores empty intervals', () => {
    expect(sessionsOverlap(session, {...session, startedAt:2000, endedAt:3000})).toBe(false)
    expect(sessionsOverlap(session, {...session, startedAt:1500, endedAt:1500})).toBe(false)
  })
  it('detects intersections including open sessions', () => {
    expect(sessionsOverlap(session, {...session, startedAt:1500, endedAt:3000})).toBe(true)
    expect(sessionsOverlap({...session, endedAt:null, endReason:null}, {...session, startedAt:5000, endedAt:6000})).toBe(true)
  })
})
