export const databaseName = 'manage-my-time'
export const schemaVersion = 4

/** Shared versioned schema; feature repositories must use the same opener. */
export class AppDatabase {
  private database: Promise<IDBDatabase> | undefined
  constructor(private readonly factory: IDBFactory | undefined = globalThis.indexedDB, private readonly name = databaseName) {}

  open(): Promise<IDBDatabase> {
    if (this.database) return this.database
    if (!this.factory) return Promise.reject(new Error('Browser storage is unavailable. Tasks cannot be saved.'))
    const promise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory!.open(this.name, schemaVersion)
      let blocked = false
      request.onupgradeneeded = event => {
        // A previously rejected blocked request must not later mutate the schema.
        if (blocked) { request.transaction!.abort(); return }
        const db = request.result
        if (event.oldVersion < 1) {
          const tasks = db.createObjectStore('tasks', { keyPath: 'id' })
          tasks.createIndex('status', 'status')
        }
        if (event.oldVersion < 2) {
          const sessions = db.createObjectStore('workSessions', { keyPath: 'id' })
          sessions.createIndex('taskId', 'taskId')
          sessions.createIndex('startedAt', 'startedAt')
          db.createObjectStore('activeSession', { keyPath: 'key' })
          db.createObjectStore('recovery', { keyPath: 'key' })
        }
        if (event.oldVersion < 4) {
          const cursorRequest = request.transaction!.objectStore('tasks').openCursor()
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result
            if (!cursor) return
            const task = cursor.value
            if (event.oldVersion < 3) {
              delete task.progressPercent
              task.previousHours ??= 0
            }
            task.confirmation.inactivityMinutes ??= 10
            cursor.update(task)
            cursor.continue()
          }
        }

      }
      request.onblocked = () => {
        blocked = true
        reject(new Error('Close other ManageMyTime tabs, then retry to finish updating browser storage.'))
      }
      request.onerror = () => reject(new Error('Cannot open browser storage. Your existing data has not been reset.'))
      request.onsuccess = () => {
        const db = request.result
        if (blocked) { db.close(); return }
        db.onversionchange = () => { db.close(); if (this.database === promise) this.database = undefined }
        db.onclose = () => { if (this.database === promise) this.database = undefined }
        resolve(db)
      }
    })
    this.database = promise
    void promise.catch(() => { if (this.database === promise) this.database = undefined })
    return promise
  }
}
