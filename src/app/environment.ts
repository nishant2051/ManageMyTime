import { PresenceCoordinator } from '../infrastructure/presenceCoordinator'
import { IndexedDBSessionHistory } from '../persistence/sessionHistory'
import { SessionCoordinator } from '../infrastructure/sessionCoordinator'
import { SessionEngine } from '../application/sessionEngine'
import { BrowserClock } from '../infrastructure/browserClock'
import { AppDatabase } from '../persistence/database'
import { IndexedDBSessionCommands } from '../persistence/sessionCommands'
import { IndexedDBSessionReader } from '../persistence/sessionReader'
import { TaskService } from '../application/taskService'
import { IndexedDBTaskRepository } from '../persistence/taskRepository'

export interface AppEnvironment {
  readonly appName: string
  readonly tasks: TaskService
  readonly sessions: SessionEngine
  readonly coordination: SessionCoordinator
  readonly presence: PresenceCoordinator
  readonly history: IndexedDBSessionHistory
}
export function createAppEnvironment(): AppEnvironment {
  const database = new AppDatabase()
  const sessions = new SessionEngine(new IndexedDBSessionReader(database), new BrowserClock(), crypto.randomUUID(), new IndexedDBSessionCommands(database))
  return Object.freeze({ appName: 'ManageMyTime', tasks: new TaskService(new IndexedDBTaskRepository(), undefined, undefined, undefined, async task => {
    if (sessions.getSnapshot().mode === 'uninitialized') await sessions.reconcile()
    const records = sessions.getSnapshot().records
    const expectedSession = records.session?.taskId === task.id && records.active
      ? {sessionId:records.session.id,generation:records.active.generation} : null
    await sessions.dispatch({type:'complete',taskId:task.id,taskRevision:task.revision,expectedSession})
  }), sessions, presence: new PresenceCoordinator(sessions), coordination: new SessionCoordinator(sessions), history: new IndexedDBSessionHistory(database) })
}
