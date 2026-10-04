import type { SessionReader, SessionRecords } from '../domain/sessionStore'
import type { ActiveSessionRecord, SessionRecoveryRecord, WorkSession } from '../domain/workSession'
import { validateWorkSession } from '../domain/workSession'
import { AppDatabase } from './database'

/** Reads one coherent committed view; never creates or repairs session history. */
export class IndexedDBSessionReader implements SessionReader {
  constructor(private readonly database: AppDatabase) {}
  async read(): Promise<SessionRecords> {
    const db = await this.database.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['workSessions', 'activeSession', 'recovery'], 'readonly')
      const sessions = tx.objectStore('workSessions').getAll()
      const active = tx.objectStore('activeSession').get('active')
      const recovery = tx.objectStore('recovery').get('active')
      tx.onabort = () => reject(new Error('Session state could not be loaded. Existing history has not been reset.'))
      tx.oncomplete = () => {
        try {
          const open = (sessions.result as WorkSession[]).filter(session => session.endedAt === null)
          if (open.length > 1) throw new Error('Multiple open sessions need resolution. Existing history has not been changed.')
          const session = open[0] ? validateWorkSession(open[0]) : null
          resolve({ session, active: (active.result as ActiveSessionRecord | undefined) ?? null,
            recovery: (recovery.result as SessionRecoveryRecord | undefined) ?? null })
        } catch (error) { reject(error) }
      }
    })
  }
}
