import type { ClockSample } from './clock'
import type { ActiveSessionRecord, SessionRecoveryRecord, WorkSession } from './workSession'

export interface SessionRecords {
  readonly session: WorkSession | null
  readonly active: ActiveSessionRecord | null
  readonly recovery: SessionRecoveryRecord | null
}
export interface SessionReader {
  read(): Promise<SessionRecords>
}
export type RecoveryResolution = { readonly type: 'end'; readonly endedAt: number } | { readonly type: 'discard' }
export type SessionCommand =
  | { readonly type: 'recover'; readonly sessionId: string; readonly sessionRevision: number; readonly expectedOwner: {readonly ownerId:string; readonly generation:number; readonly lastRuntimeCheckpointAt:number} | null; readonly resolution: RecoveryResolution }
  | { readonly type: 'start' | 'resume'; readonly taskId: string }
  | { readonly type: 'activity'; readonly sessionId: string; readonly generation: number; readonly activityAt: number }
  | { readonly type: 'presence'; readonly sessionId: string; readonly generation: number }
  | { readonly type: 'answer'; readonly sessionId: string; readonly generation: number; readonly promptId: string; readonly answer: 'continue' | 'pause' | 'timeout' }
  | { readonly type: 'checkpoint'; readonly sessionId: string; readonly generation: number }
  | { readonly type: 'pause'; readonly sessionId: string; readonly generation: number }
  | { readonly type: 'switch'; readonly sessionId: string; readonly generation: number; readonly taskId: string }
  | { readonly type: 'complete'; readonly taskId: string; readonly taskRevision: number; readonly expectedSession: { readonly sessionId: string; readonly generation: number } | null }

export interface SessionCommandContext {
  readonly clock: ClockSample
  readonly ownerId: string
}
/** Implement in F02.3/F02.4. Resolution means the entire transaction committed. */
export interface SessionCommandHandler {
  commit(command: SessionCommand, context: SessionCommandContext): Promise<SessionRecords>
}
