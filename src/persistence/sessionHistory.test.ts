import { expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { AppDatabase } from './database'
import { IndexedDBSessionHistory } from './sessionHistory'
import type { WorkSession } from '../domain/workSession'
import { endedTotal, formatDuration } from '../presentation/sessionDisplay'

it('returns persisted history newest first and excludes open intervals and pause gaps from totals', async ()=>{
  const database=new AppDatabase(new IDBFactory())
  const db=await database.open()
  const base:WorkSession={id:'first',taskId:'task-1',startedAt:1000,endedAt:2000,creationSource:'tracked',wasCorrected:false,endReason:'userPaused',timezone:'UTC',createdAt:1000,updatedAt:2000,revision:2}
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('workSessions','readwrite');const store=tx.objectStore('workSessions')
    store.add(base)
    store.add({...base,id:'second',startedAt:10_000,endedAt:12_000,createdAt:10_000,updatedAt:12_000})
    store.add({...base,id:'open',taskId:'task-2',startedAt:15_000,endedAt:null,endReason:null,createdAt:15_000,updatedAt:15_000,revision:1})
    tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)
  })
  const history=await new IndexedDBSessionHistory(database).list()
  expect(history.map(item=>item.id)).toEqual(['open','second','first'])
  expect(endedTotal(history)).toBe(3000)
  expect(endedTotal(history,'task-1')).toBe(3000)
  expect(endedTotal(history,'task-2')).toBe(0)
  expect(history[0].endedAt).toBeNull()
  expect(formatDuration(endedTotal(history))).toBe('00:00:03')
})

it('duration display preserves days as accumulated hours without rounding up', ()=>{
  expect(formatDuration(25 * 3600_000 + 61_999)).toBe('25:01:01')
})
