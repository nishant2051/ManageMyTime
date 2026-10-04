import type { WorkTask } from '../domain/task'
import type { TaskRepository } from '../domain/taskRepository'

import { AppDatabase, databaseName } from './database'

export class IndexedDBTaskRepository implements TaskRepository {
  private readonly database: AppDatabase
  constructor(factory: IDBFactory | undefined = globalThis.indexedDB, name = databaseName) {
    this.database = new AppDatabase(factory, name)
  }

  async list(): Promise<WorkTask[]> {
    const db = await this.database.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tasks', 'readonly')
      const request = tx.objectStore('tasks').getAll()
      tx.oncomplete = () => resolve(request.result as WorkTask[])
      tx.onabort = () => reject(new Error('Tasks could not be loaded. Retry when browser storage is available.'))
    })
  }

  async insert(task: WorkTask): Promise<void> {
    const db = await this.database.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tasks', 'readwrite')
      tx.objectStore('tasks').add(task)
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(new Error('Task was not saved. Check available browser storage and retry.'))
    })
  }

  async update(id: string, revision: number, change: (task: WorkTask) => WorkTask): Promise<void> {
    const db = await this.database.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['tasks', 'workSessions'], 'readwrite')
      const store = tx.objectStore('tasks')
      let error: Error | undefined
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(error ?? new Error('Changes were not saved. Check browser storage and retry.'))
      const request = store.get(id)
      request.onsuccess = () => {
        try {
          const current = request.result as WorkTask | undefined
          if (!current) throw new Error('This task no longer exists. Refresh the list.')
          if (current.revision !== revision) throw new Error('This task changed in another tab. Refresh the list before editing it again.')
          const changed = change(current)
          if (changed.status === current.status) { store.put(changed); return }
          // Until F02.4 coordinates completion with the engine, lifecycle changes
          // must never leave a session attached to a completed/archived task.
          const sessions = tx.objectStore('workSessions').index('taskId').getAll(id)
          sessions.onsuccess = () => {
            const open = (sessions.result as {endedAt:number | null}[]).some(session => session.endedAt === null)
            if (open) {
              error = new Error('Pause this task before completing or archiving it.')
              tx.abort()
            } else { store.put(changed) }
          }
        } catch (cause) {
          error = cause instanceof Error ? cause : new Error('Task update failed.')
          tx.abort()
        }
      }
    })
  }
}
