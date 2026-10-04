import type { WorkTask } from '../domain/task'
import type { SessionSnapshot } from '../application/sessionEngine'
import type { WorkSession, SessionEndReason } from '../domain/workSession'

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor(seconds / 60 % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

/** Open/uncertain intervals never enter accumulated ended-session totals. */
export function endedTotal(sessions: readonly WorkSession[], taskId?: string): number {
  return sessions.reduce((total, session) => total + (session.endedAt !== null && (!taskId || session.taskId === taskId)
    ? session.endedAt - session.startedAt : 0), 0)
}

export const endReasonLabels: Record<SessionEndReason, string> = {
  userPaused:'Paused',taskCompleted:'Task completed',taskSwitched:'Switched task',
  confirmationTimeout:'Confirmation timed out',interruptedRecovery:'Recovered interruption',manual:'Manual entry',
}

/** Starting balance plus committed sessions and a known live session; uncertain time is excluded. */
export function workedTotal(task: WorkTask, sessions: readonly WorkSession[], snapshot?: SessionSnapshot): number {
  const live = snapshot?.records.session
  const elapsed = live?.taskId === task.id && live.endedAt === null ? snapshot?.elapsedMilliseconds ?? 0 : 0
  return Math.round(task.previousHours * 3600000) + endedTotal(sessions, task.id) + elapsed
}
