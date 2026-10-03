import type { WorkTask } from '../domain/task'
import type { TaskRepository } from '../domain/taskRepository'

export const databaseName = 'manage-my-time'
export const schemaVersion = 1

export class IndexedDBTaskRepository implements TaskRepository {
  private database: Promise<IDBDatabase> | undefined
  constructor(private readonly factory: IDBFactory | undefined = globalThis.indexedDB, private readonly name = databaseName) {}

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database
    if (!this.factory) return Promise.reject(new Error('Browser storage is unavailable. Tasks cannot be saved.'))
    const promise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory!.open(this.name, schemaVersion)
      let blocked = false
      request.onupgradeneeded = () => {
        const db = request.result
        const tasks = db.createObjectStore('tasks', { keyPath: 'id' })
        tasks.createIndex('status', 'status')
      }
      request.onblocked = () => {
        blocked = true
        reject(new Error('Close other ManageMyTime tabs, then retry to finish updating browser storage.'))
      }
      request.onerror = () => reject(new Error('Cannot open browser storage. Your existing data has not been reset.'))
      request.onsuccess = () => {
        const db = request.result
        if (blocked) { db.close(); return }
        db.onversionchange = () => { db.close(); this.database = undefined }
        db.onclose = () => { this.database = undefined }
        resolve(db)
      }
    })
    this.database = promise
    void promise.catch(() => { if (this.database === promise) this.database = undefined })
    return promise
  }

  async list(): Promise<WorkTask[]> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tasks', 'readonly')
      const request = tx.objectStore('tasks').getAll()
      tx.oncomplete = () => resolve(request.result as WorkTask[])
      tx.onabort = () => reject(new Error('Tasks could not be loaded. Retry when browser storage is available.'))
    })
  }

  async insert(task: WorkTask): Promise<void> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tasks', 'readwrite')
      tx.objectStore('tasks').add(task)
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(new Error('Task was not saved. Check available browser storage and retry.'))
    })
  }

  async update(id: string, revision: number, change: (task: WorkTask) => WorkTask): Promise<void> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tasks', 'readwrite')
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
          store.put(change(current))
        } catch (cause) {
          error = cause instanceof Error ? cause : new Error('Task update failed.')
          tx.abort()
        }
      }
    })
  }
}
