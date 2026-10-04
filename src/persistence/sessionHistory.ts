import { validateWorkSession, type WorkSession } from '../domain/workSession'
import { AppDatabase } from './database'

export class IndexedDBSessionHistory {
  constructor(private readonly database: AppDatabase) {}

  async list(): Promise<WorkSession[]> {
    const db = await this.database.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('workSessions', 'readonly')
      const request = tx.objectStore('workSessions').getAll()
      tx.onabort = () => reject(new Error('Session history could not be loaded. Your saved sessions are unchanged.'))
      tx.oncomplete = () => {
        try {
          resolve((request.result as WorkSession[]).map(validateWorkSession)
            .sort((a, b) => b.startedAt - a.startedAt || b.id.localeCompare(a.id)))
        } catch (error) { reject(error) }
      }
    })
  }
}
