import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { AppDatabase } from './database'
import { IndexedDBSessionReader } from './sessionReader'
import type { WorkSession } from '../domain/workSession'

const session: WorkSession = {id:'session-1',taskId:'task-1',startedAt:1000,endedAt:null,creationSource:'tracked',wasCorrected:false,
  endReason:null,timezone:'UTC',createdAt:1000,updatedAt:1000,revision:1}
async function write(db: IDBDatabase, records: WorkSession[]) {
  await new Promise<void>((resolve,reject) => {
    const tx=db.transaction(['workSessions','activeSession','recovery'],'readwrite')
    for (const item of records) tx.objectStore('workSessions').add(item)
    tx.objectStore('activeSession').put({key:'active',sessionId:session.id,ownerId:'owner-1',generation:1,leaseExpiresAt:5000,lastRuntimeCheckpointAt:1000})
    tx.objectStore('recovery').put({key:'active',sessionId:session.id,lastRuntimeCheckpointAt:1000,lastUserConfirmedAt:1000,pendingConfirmation:null})
    tx.oncomplete=()=>resolve(); tx.onabort=()=>reject(tx.error)
  })
}
describe('coherent session reads', () => {
  it('reads empty state without creating session or marker records', async () => {
    const database=new AppDatabase(new IDBFactory())
    expect(await new IndexedDBSessionReader(database).read()).toEqual({session:null,active:null,recovery:null})
  })
  it('reads open session, marker and recovery from one committed database view', async () => {
    const database=new AppDatabase(new IDBFactory()); await write(await database.open(),[session])
    const result=await new IndexedDBSessionReader(database).read()
    expect(result.session).toEqual(session)
    expect(result.active?.sessionId).toBe(session.id)
    expect(result.recovery?.lastUserConfirmedAt).toBe(1000)
  })
  it('rejects multiple open sessions without rewriting records', async () => {
    const database=new AppDatabase(new IDBFactory()); const db=await database.open()
    await write(db,[session,{...session,id:'session-2'}])
    await expect(new IndexedDBSessionReader(database).read()).rejects.toThrow('Multiple open sessions')
    const count=await new Promise<number>(resolve=>{
      const tx=db.transaction('workSessions','readonly'); const request=tx.objectStore('workSessions').count()
      tx.oncomplete=()=>resolve(request.result)
    })
    expect(count).toBe(2)
  })
})
