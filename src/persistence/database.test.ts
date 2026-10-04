import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { AppDatabase, databaseName } from './database'
import { IndexedDBTaskRepository } from './taskRepository'
import type { WorkTask } from '../domain/task'

const fixture: Omit<WorkTask, 'previousHours'> & {progressPercent: number} = {id:'existing-task', name:'Keep my task', type:'reading', status:'archived', notes:'Private notes',
  progressPercent:63, confirmation:{enabled:true, intervalMinutes:45, inactivityMinutes:10, graceMinutes:2},
  createdAt:1000, updatedAt:3000, completedAt:2000, archivedAt:3000, revision:3}
async function versionOne(factory: IDBFactory): Promise<IDBDatabase> {
  const db = await new Promise<IDBDatabase>((resolve,reject) => {
    const request = factory.open(databaseName,1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('tasks',{keyPath:'id'})
      store.createIndex('status','status')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  await new Promise<void>((resolve,reject) => {
    const tx = db.transaction('tasks','readwrite'); tx.objectStore('tasks').add(fixture)
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error)
  })
  return db
}
describe('versioned database migration', () => {
  it('creates V4 for a fresh profile with expected stores and indexes', async () => {
    const db = await new AppDatabase(new IDBFactory()).open()
    expect(db.version).toBe(4)
    expect(Array.from(db.objectStoreNames)).toEqual(['activeSession','recovery','tasks','workSessions'])
    const tx = db.transaction(['tasks','workSessions'],'readonly')
    expect(Array.from(tx.objectStore('workSessions').indexNames)).toEqual(['startedAt','taskId'])
    const marker = db.transaction('activeSession','readonly').objectStore('activeSession')
    expect(marker.keyPath).toBe('key')
  })
  it('preserves every V1 task field and creates empty session stores', async () => {
    const factory = new IDBFactory(); const old = await versionOne(factory); old.close()
    const db = await new AppDatabase(factory).open()
    expect(db.version).toBe(4)
    expect(await new IndexedDBTaskRepository(factory).list()).toEqual([{...fixture, progressPercent: undefined, previousHours: 0}])
    const sessions = await new Promise<unknown[]>((resolve,reject) => {
      const tx = db.transaction('workSessions','readonly'); const request = tx.objectStore('workSessions').getAll()
      tx.oncomplete = () => resolve(request.result); tx.onabort = () => reject(tx.error)
    })
    expect(sessions).toEqual([])
  })
  it('reports blocked upgrades and permits retry without modifying tasks', async () => {
    const factory = new IDBFactory(); const old = await versionOne(factory)
    const database = new AppDatabase(factory)
    await expect(database.open()).rejects.toThrow('Close other')
    old.close()
    expect((await database.open()).version).toBe(4)
    expect(await new IndexedDBTaskRepository(factory).list()).toEqual([{...fixture, progressPercent: undefined, previousHours: 0}])
  })
  it('aborted upgrade rolls back both schema and data and can be retried', async () => {
    const factory = new IDBFactory(); const old = await versionOne(factory); old.close()
    const open = factory.open.bind(factory)
    const failingFactory = {open(name: string, version?: number) {
      const request = open(name,version)
      request.addEventListener('upgradeneeded', () => { queueMicrotask(() => request.transaction?.abort()) })
      return request
    }} as IDBFactory
    await expect(new AppDatabase(failingFactory).open()).rejects.toThrow('not been reset')
    const unchanged = await new Promise<IDBDatabase>((resolve,reject) => {
      const request = open(databaseName)
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
    })
    expect(unchanged.version).toBe(1)
    expect(Array.from(unchanged.objectStoreNames)).toEqual(['tasks'])
    unchanged.close()
    expect(await new IndexedDBTaskRepository(factory).list()).toEqual([{...fixture, progressPercent: undefined, previousHours: 0}])
  })
})
