import type { SessionRecoveryRecord, WorkSession } from './workSession'

/** Runtime checkpoints prove liveness, so they are never proposed as worked time. */
export function suggestedRecoveryEnd(session: WorkSession, evidence: Readonly<SessionRecoveryRecord> | null): number {
  if (!evidence || evidence.sessionId !== session.id) return session.startedAt
  const prompt = evidence.pendingConfirmation
  const boundary = prompt ? prompt.cutoffAt ?? evidence.lastUserConfirmedAt
    : Math.max(evidence.lastActivityAt ?? evidence.lastUserConfirmedAt, evidence.lastUserConfirmedAt)
  return Number.isSafeInteger(boundary) && boundary >= session.startedAt && boundary <= evidence.lastRuntimeCheckpointAt
    ? boundary : session.startedAt
}
