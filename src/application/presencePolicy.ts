import type { ConfirmationPolicy } from '../domain/task'
import type { SessionRecoveryRecord } from '../domain/workSession'

export function presenceDue(policy: ConfirmationPolicy, evidence: SessionRecoveryRecord, now: number): 'periodic' | 'inactivity' | null {
  const activity = Math.max(evidence.lastActivityAt ?? evidence.lastUserConfirmedAt, evidence.lastUserConfirmedAt)
  const inactiveAt = activity + policy.inactivityMinutes * 60000
  const periodicAt = policy.enabled ? evidence.lastUserConfirmedAt + policy.intervalMinutes * 60000 : Infinity
  if (now < Math.min(inactiveAt, periodicAt)) return null
  return inactiveAt <= periodicAt ? 'inactivity' : 'periodic'
}
