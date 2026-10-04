export const sessionEndReasons = [
  'userPaused', 'taskCompleted', 'taskSwitched', 'confirmationTimeout',
  'interruptedRecovery', 'manual',
] as const
export type SessionEndReason = typeof sessionEndReasons[number]
export type SessionCreationSource = 'tracked' | 'manual'

/** Persisted wall-clock timestamps are UTC epoch milliseconds, never timer ticks. */
export interface WorkSession {
  id: string
  taskId: string
  startedAt: number
  endedAt: number | null
  creationSource: SessionCreationSource
  wasCorrected: boolean
  endReason: SessionEndReason | null
  timezone: string
  createdAt: number
  updatedAt: number
  revision: number
}

/** Singleton marker. A runtime lease proves owner liveness, not continued work. */
export interface ActiveSessionRecord {
  key: 'active'
  sessionId: string
  ownerId: string
  generation: number
  leaseExpiresAt: number
  lastRuntimeCheckpointAt: number
}

export interface PendingConfirmationRecord {
  promptId: string
  sessionId: string
  generation: number
  dueAt: number
  graceDeadlineAt: number
}

/** Persisted recovery evidence; monotonic clock values do not survive reload. */
export interface SessionRecoveryRecord {
  key: 'active'
  sessionId: string
  lastRuntimeCheckpointAt: number
  lastUserConfirmedAt: number
  pendingConfirmation: PendingConfirmationRecord | null
}

function validTimestamp(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000
}

export function validateWorkSession(session: WorkSession): WorkSession {
  if (!session.id.trim() || !session.taskId.trim()) throw new Error('Session and task identities are required.')
  if (![session.startedAt, session.createdAt, session.updatedAt].every(validTimestamp) ||
      (session.endedAt !== null && !validTimestamp(session.endedAt))) {
    throw new Error('Session timestamps must be valid UTC epoch milliseconds.')
  }
  if (session.endedAt !== null && session.endedAt < session.startedAt) throw new Error('A session cannot end before it starts.')
  if ((session.endedAt === null) !== (session.endReason === null)) throw new Error('Only ended sessions have an end reason.')
  if (session.endReason !== null && !sessionEndReasons.includes(session.endReason)) throw new Error('Invalid session end reason.')
  if (!['tracked', 'manual'].includes(session.creationSource)) throw new Error('Invalid session creation source.')
  if (session.creationSource === 'manual' && session.endedAt === null) throw new Error('Manual historical sessions must have an end time.')
  if (!Number.isSafeInteger(session.revision) || session.revision < 1) throw new Error('Session revision must be a positive integer.')
  if (session.updatedAt < session.createdAt) throw new Error('Session update time cannot precede its creation time.')
  try {
    if (!session.timezone.trim()) throw new Error('Missing timezone')
    new Intl.DateTimeFormat('en', { timeZone: session.timezone })
  } catch { throw new Error('Use a valid timezone for the session.') }
  return { ...session }
}

/** Ended duration only. An open session requires the engine's live clock context. */
export function completedDurationMilliseconds(session: WorkSession): number | null {
  validateWorkSession(session)
  return session.endedAt === null ? null : session.endedAt - session.startedAt
}

/** Half-open intervals may touch; zero-length ended sessions occupy no time. */
export function sessionsOverlap(first: WorkSession, second: WorkSession): boolean {
  validateWorkSession(first); validateWorkSession(second)
  if (first.endedAt === first.startedAt || second.endedAt === second.startedAt) return false
  return first.startedAt < (second.endedAt ?? Infinity) && second.startedAt < (first.endedAt ?? Infinity)
}
