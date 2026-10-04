import type { SessionCommand, SessionCommandContext, SessionCommandHandler, SessionRecords } from '../domain/sessionStore'
import type { ActiveSessionRecord, SessionRecoveryRecord, WorkSession } from '../domain/workSession'
import { sessionsOverlap, validateWorkSession } from '../domain/workSession'
import { presenceDue } from '../application/presencePolicy'
import type { WorkTask } from '../domain/task'
import { SessionEngineError } from '../domain/sessionError'
import { AppDatabase } from './database'

/** Initial lease only; renewal/ownership coordination follow in F02.5/F03. */
export const initialSessionLeaseMilliseconds = 60_000

export class IndexedDBSessionCommands implements SessionCommandHandler {
  constructor(
    private readonly database: AppDatabase,
    private readonly id: () => string = () => crypto.randomUUID(),
    private readonly timezone: () => string = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  ) {}

  async commit(command: SessionCommand, context: SessionCommandContext): Promise<SessionRecords> {
    if (!context.ownerId.trim() || !Number.isSafeInteger(context.clock.wallTime) || context.clock.wallTime < 0 ||
        !Number.isFinite(context.clock.monotonicTime) || context.clock.monotonicTime < 0) {
      throw new SessionEngineError('invalidClock', 'A valid runtime identity and clock sample are required.')
    }
    const now = context.clock.wallTime
    const db = await this.database.open()
    return new Promise((resolve, reject) => {
      // Overlapping readwrite scopes serialize even across different tabs/connections.
      const tx = db.transaction(['tasks', 'workSessions', 'activeSession', 'recovery'], 'readwrite')
      let result: SessionRecords | undefined
      let error: Error | undefined
      tx.oncomplete = () => {
        if (result) resolve(result)
        else reject(new SessionEngineError('invalidState', 'Session transaction completed without a result.'))
      }
      tx.onabort = () => reject(error ?? new SessionEngineError('storageUnavailable', 'Session changes were not saved. Existing history is unchanged.', {cause:tx.error}))
      const sessionsRequest = tx.objectStore('workSessions').getAll()
      const activeRequest = tx.objectStore('activeSession').get('active')
      const recoveryRequest = tx.objectStore('recovery').get('active')
      const tasksRequest = tx.objectStore('tasks').getAll()
      let outstanding = 4
      const ready = () => {
        if (--outstanding !== 0) return
        try {
          const history = (sessionsRequest.result as WorkSession[]).map(validateWorkSession)
          const open = history.filter(session => session.endedAt === null)
          const active = (activeRequest.result as ActiveSessionRecord | undefined) ?? null
          const recovery = (recoveryRequest.result as SessionRecoveryRecord | undefined) ?? null
          const tasks = tasksRequest.result as WorkTask[]
          if (open.length > 1) throw new SessionEngineError('recoveryRequired', 'Multiple open sessions require resolution before tracking.')
          if (command.type === 'recover') {
            const session = open[0]
            if (!session || session.id !== command.sessionId || session.revision !== command.sessionRevision) throw new SessionEngineError('staleCommand', 'This session has changed. Refresh tracking before recovering it.')
            if ((active && active.sessionId !== session.id) || (recovery && recovery.sessionId !== session.id)) throw new SessionEngineError('recoveryRequired', 'Session records disagree. Existing history has been preserved.')
            const expected = command.expectedOwner
            if (active ? !expected || active.ownerId !== expected.ownerId || active.generation !== expected.generation || active.lastRuntimeCheckpointAt !== expected.lastRuntimeCheckpointAt : expected !== null) {
              throw new SessionEngineError('staleCommand', 'Tracking ownership changed. Refresh tracking and review the session again.')
            }
            if (active && active.ownerId !== context.ownerId && (!Number.isSafeInteger(active.leaseExpiresAt) || active.leaseExpiresAt > now)) {
              throw new SessionEngineError('conflict', 'Another tab still owns this session. Wait for it to stop or close that tab, then refresh tracking.')
            }
            if (command.resolution.type === 'discard') {
              tx.objectStore('workSessions').delete(session.id)
            } else {
              const endedAt = command.resolution.endedAt
              if (!Number.isSafeInteger(endedAt) || endedAt < session.startedAt || endedAt > now) throw new SessionEngineError('validation', 'Choose an end time between the session start and now.')
              const ended = validateWorkSession({...session,endedAt,endReason:'interruptedRecovery',wasCorrected:true,updatedAt:Math.max(now,session.updatedAt),revision:session.revision + 1})
              if (history.some(other => other.id !== ended.id && sessionsOverlap(ended,other))) throw new SessionEngineError('conflict', 'This end time overlaps another recorded session. Choose an earlier time.')
              tx.objectStore('workSessions').put(ended)
            }
            // Ending/discarding and releasing ownership commit together; never auto-resume.
            tx.objectStore('activeSession').delete('active')
            tx.objectStore('recovery').delete('active')
            result = {session:null,active:null,recovery:null}
            return
          }
          if ((!open.length && (active || recovery)) || (open.length && (!active || !recovery ||
              active.key !== 'active' || recovery.key !== 'active' || active.sessionId !== open[0].id || recovery.sessionId !== open[0].id))) {
            throw new SessionEngineError('recoveryRequired', 'Session evidence is incomplete. Resolve it before changing history.')
          }
          if (active && (!active.ownerId.trim() || !Number.isSafeInteger(active.generation) || active.generation < 1 ||
              !Number.isSafeInteger(active.leaseExpiresAt) || !Number.isSafeInteger(active.lastRuntimeCheckpointAt) ||
              active.lastRuntimeCheckpointAt < open[0].startedAt || active.leaseExpiresAt <= active.lastRuntimeCheckpointAt ||
              !Number.isSafeInteger(recovery!.lastRuntimeCheckpointAt) || recovery!.lastRuntimeCheckpointAt !== active.lastRuntimeCheckpointAt ||
              !Number.isSafeInteger(recovery!.lastUserConfirmedAt) || recovery!.lastUserConfirmedAt < open[0].startedAt)) {
            throw new SessionEngineError('recoveryRequired', 'Invalid ownership evidence requires resolution before tracking.')
          }
          if (command.type === 'activity' || command.type === 'presence' || command.type === 'answer') {
            const session = open[0]
            if (!session || session.id !== command.sessionId || active!.generation !== command.generation) throw new SessionEngineError('staleCommand', 'This presence check is no longer active.')
            if (active!.ownerId !== context.ownerId) throw new SessionEngineError('conflict', 'Respond in the tab tracking this session.')
            if (active!.leaseExpiresAt <= now || now < active!.lastRuntimeCheckpointAt) throw new SessionEngineError('recoveryRequired', 'Tracking was interrupted. Resolve uncertain time first.')
            const task = tasks.find(task => task.id === session.taskId)
            if (!task || task.status !== 'ready') throw new SessionEngineError('invalidState', 'The tracked task is unavailable.')
            const evidence = {...recovery!}
            const prompt = evidence.pendingConfirmation
            if (command.type === 'answer') {
              if (!prompt || prompt.promptId !== command.promptId || prompt.sessionId !== session.id || prompt.generation !== active!.generation) throw new SessionEngineError('staleCommand', 'This prompt has already changed.')
              if (command.answer === 'timeout' && now < prompt.graceDeadlineAt) throw new SessionEngineError('validation', 'The grace period has not ended.')
              if (command.answer === 'continue' && now < prompt.graceDeadlineAt) {
                evidence.lastUserConfirmedAt = now
                evidence.lastActivityAt = now
                evidence.pendingConfirmation = null
              } else {
                const cutoff = prompt.cutoffAt ?? evidence.lastUserConfirmedAt
                if (!Number.isSafeInteger(cutoff) || cutoff < session.startedAt || cutoff > prompt.dueAt || prompt.dueAt > now) throw new SessionEngineError('validation', 'Invalid presence cutoff.')
                const ended = validateWorkSession({...session, endedAt:cutoff, endReason:command.answer === 'pause' ? 'userPaused' : 'confirmationTimeout', updatedAt:now, revision:session.revision + 1})
                if (history.some(other => other.id !== ended.id && sessionsOverlap(ended, other))) throw new SessionEngineError('conflict', 'Presence cutoff overlaps history.')
                tx.objectStore('workSessions').put(ended)
                tx.objectStore('activeSession').delete('active')
                tx.objectStore('recovery').delete('active')
                result = {session:null,active:null,recovery:null}
                return
              }
            } else if (command.type === 'activity') {
              // A pending prompt requires an explicit answer; incidental movement is not confirmation.
              if (!Number.isSafeInteger(command.activityAt) || command.activityAt < session.startedAt || command.activityAt > now) throw new SessionEngineError('validation', 'Invalid activity timestamp.')
              if (!prompt) evidence.lastActivityAt = Math.max(command.activityAt, evidence.lastActivityAt ?? evidence.lastUserConfirmedAt)
            } else if (!prompt) {
              const due = presenceDue(task.confirmation, evidence, now)
              if (due) evidence.pendingConfirmation = {promptId:this.id(),sessionId:session.id,generation:active!.generation,dueAt:now,
                graceDeadlineAt:now + Math.round(task.confirmation.graceMinutes * 60000), reason:due,
                cutoffAt:Math.max(evidence.lastActivityAt ?? evidence.lastUserConfirmedAt, evidence.lastUserConfirmedAt)}
            }
            evidence.lastRuntimeCheckpointAt = now
            const marker = {...active!, lastRuntimeCheckpointAt:now, leaseExpiresAt:now + initialSessionLeaseMilliseconds}
            tx.objectStore('recovery').put(evidence)
            tx.objectStore('activeSession').put(marker)
            result = {session,active:marker,recovery:evidence}
            return
          }
          if (command.type === 'checkpoint') {
            const session = open[0]
            if (!session || session.id !== command.sessionId || active!.generation !== command.generation) throw new SessionEngineError('staleCommand', 'Session ownership has changed.')
            if (active!.ownerId !== context.ownerId) throw new SessionEngineError('conflict', 'This session belongs to another runtime.')
            if (active!.leaseExpiresAt <= now || now < active!.lastRuntimeCheckpointAt ) throw new SessionEngineError('recoveryRequired', 'Resolve interrupted tracking before renewing ownership.')
            const marker = {...active!,leaseExpiresAt:now + initialSessionLeaseMilliseconds,lastRuntimeCheckpointAt:now}
            const evidence = {...recovery!,lastRuntimeCheckpointAt:now}
            tx.objectStore('activeSession').put(marker)
            tx.objectStore('recovery').put(evidence)
            result = {session,active:marker,recovery:evidence}
            return
          }
          const currentRecords: SessionRecords = {session:open[0] ?? null, active, recovery}
          const completingTask = command.type === 'complete' ? tasks.find(task => task.id === command.taskId) : undefined
          if (command.type === 'complete') {
            if (!completingTask || completingTask.status !== 'ready') throw new SessionEngineError('validation', 'Only active tasks can be completed.')
            if (completingTask.revision !== command.taskRevision) throw new SessionEngineError('staleCommand', 'This task has changed. Refresh task state.')
            const targeted = open[0]?.taskId === command.taskId ? open[0] : null
            if (targeted ? !command.expectedSession || command.expectedSession.sessionId !== targeted.id || command.expectedSession.generation !== active!.generation : command.expectedSession !== null) {
              throw new SessionEngineError('staleCommand', 'This task session has changed. Refresh session state.')
            }
            if (!targeted) {
              tx.objectStore('tasks').put({...completingTask, status:'completed', completedAt:now, updatedAt:now, revision:completingTask.revision + 1})
              result = currentRecords
              return
            }
          }
          if (command.type === 'pause' || command.type === 'switch' || command.type === 'complete') {
            const session = open[0]
            if (!session || session.id !== (command.type === 'complete' ? command.expectedSession!.sessionId : command.sessionId) || active!.generation !== (command.type === 'complete' ? command.expectedSession!.generation : command.generation)) {
              throw new SessionEngineError('staleCommand', 'This session has already changed. Refresh session state.')
            }
            if (active!.ownerId !== context.ownerId) throw new SessionEngineError('conflict', 'This session belongs to another runtime.')
            if (active!.leaseExpiresAt <= now || now < active!.lastRuntimeCheckpointAt) throw new SessionEngineError('recoveryRequired', 'Session ownership expired. Resolve interrupted tracking first.')

            const task = tasks.find(task => task.id === session.taskId)
            if (!task || task.status !== 'ready') throw new SessionEngineError('invalidState', 'The active session does not have an eligible task.')
            const ended = validateWorkSession({...session, endedAt:recovery!.pendingConfirmation ? recovery!.pendingConfirmation.cutoffAt ?? recovery!.lastUserConfirmedAt : now, endReason:command.type === 'pause' ? 'userPaused' : command.type === 'switch' ? 'taskSwitched' : 'taskCompleted', updatedAt:now, revision:session.revision + 1})
            if (history.some(other => other.id !== ended.id && sessionsOverlap(ended, other))) {
              throw new SessionEngineError('conflict', 'This end time would overlap existing work history.')
            }
            if (command.type === 'switch') {
              const target = tasks.find(task => task.id === command.taskId)
              if (!target || target.status !== 'ready' || target.id === session.taskId) throw new SessionEngineError('validation', 'Choose a different active task to switch to.')
              const next = validateWorkSession({id:this.id(), taskId:target.id, startedAt:now, endedAt:null, creationSource:'tracked', wasCorrected:false, endReason:null, timezone:this.timezone(), createdAt:now, updatedAt:now, revision:1})
              if (history.some(other => sessionsOverlap(next, other.id === ended.id ? ended : other))) throw new SessionEngineError('conflict', 'This switch would overlap existing work history.')
              const marker: ActiveSessionRecord = {key:'active',sessionId:next.id,ownerId:context.ownerId,generation:1,leaseExpiresAt:now + initialSessionLeaseMilliseconds,lastRuntimeCheckpointAt:now}
              const evidence: SessionRecoveryRecord = {key:'active',sessionId:next.id,lastRuntimeCheckpointAt:now,lastUserConfirmedAt:now,pendingConfirmation:null}
              tx.objectStore('workSessions').put(ended)
              tx.objectStore('workSessions').add(next)
              tx.objectStore('activeSession').put(marker)
              tx.objectStore('recovery').put(evidence)
              result = {session:next,active:marker,recovery:evidence}
              return
            }
            tx.objectStore('workSessions').put(ended)
            tx.objectStore('activeSession').delete('active')
            tx.objectStore('recovery').delete('active')
            if (command.type === 'complete') tx.objectStore('tasks').put({...completingTask!,status:'completed',completedAt:now,updatedAt:now,revision:completingTask!.revision + 1})
            result = {session:null, active:null, recovery:null}
          } else if (command.type === 'start' || command.type === 'resume') {
            if (open.length) throw new SessionEngineError('conflict', 'Pause the active session before starting another task.')
            const task = tasks.find(task => task.id === command.taskId)
            if (!task || task.status !== 'ready') throw new SessionEngineError('validation', 'Choose an existing active task to track.')
            if (command.type === 'resume' && !history.some(session => session.taskId === task.id && session.creationSource === 'tracked' && session.endedAt !== null)) {
              throw new SessionEngineError('validation', 'This task has no ended tracked session to resume. Start it first.')
            }
            const session = validateWorkSession({id:this.id(), taskId:task.id, startedAt:now, endedAt:null,
              creationSource:'tracked', wasCorrected:false, endReason:null, timezone:this.timezone(), createdAt:now, updatedAt:now, revision:1})
            if (history.some(other => sessionsOverlap(session, other))) throw new SessionEngineError('conflict', 'This start time would overlap existing work history.')
            // Unique session identity plus generation fence prevents stale actions after Resume.
            const marker: ActiveSessionRecord = {key:'active', sessionId:session.id, ownerId:context.ownerId, generation:1,
              leaseExpiresAt:now + initialSessionLeaseMilliseconds, lastRuntimeCheckpointAt:now}
            const evidence: SessionRecoveryRecord = {key:'active', sessionId:session.id, lastRuntimeCheckpointAt:now,
              lastUserConfirmedAt:now, pendingConfirmation:null}
            tx.objectStore('workSessions').add(session)
            tx.objectStore('activeSession').add(marker)
            tx.objectStore('recovery').add(evidence)
            result = {session, active:marker, recovery:evidence}
          }
        } catch (cause) {
          error = cause instanceof SessionEngineError ? cause : new SessionEngineError('validation', cause instanceof Error ? cause.message : 'Invalid session data.', {cause})
          tx.abort()
        }
      }
      sessionsRequest.onsuccess = ready
      activeRequest.onsuccess = ready
      recoveryRequest.onsuccess = ready
      tasksRequest.onsuccess = ready
    })
  }
}
