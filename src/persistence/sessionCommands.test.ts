import { afterEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { AppDatabase } from './database'
import { IndexedDBSessionReader } from './sessionReader'
import { IndexedDBSessionCommands } from './sessionCommands'
import { IndexedDBTaskRepository } from './taskRepository'
import { TaskService } from '../application/taskService'
import { SessionEngine } from '../application/sessionEngine'
import type { WorkSession } from '../domain/workSession'

async function setup() {
  const factory = new IDBFactory()
  const database = new AppDatabase(factory)
  const tasks = new TaskService(new IndexedDBTaskRepository(factory), () => 1000, () => 'task-1')
  await tasks.create({name:'Study',type:'active',notes:'Keep notes',previousHours:0,confirmation:{enabled:false,intervalMinutes:30, inactivityMinutes:10,graceMinutes:2}})
  const time = {wallTime:1000,monotonicTime:100}
  const clock = {sample:() => ({...time})}
  let counter=0
  const commands = new IndexedDBSessionCommands(database, () => `session-${++counter}`, () => 'UTC')
  const reader = new IndexedDBSessionReader(database)
  const engine = new SessionEngine(reader,clock,'owner-1',commands)
  await engine.reconcile()
  async function history() {
    const db=await database.open()
    return new Promise<WorkSession[]>((resolve,reject) => {
      const tx=db.transaction('workSessions','readonly'); const request=tx.objectStore('workSessions').getAll()
      tx.oncomplete=()=>resolve(request.result); tx.onabort=()=>reject(tx.error)
    })
  }
  return {engine,commands,reader,database,tasks,time,history}
}
afterEach(() => vi.restoreAllMocks())
describe('transactional Start/Pause/Resume', () => {
  it('creates discrete persisted sessions and excludes the paused interval', async () => {
    const {engine,reader,time,history,tasks}=await setup()
    const started=await engine.dispatch({type:'start',taskId:'task-1'})
    expect(started.mode).toBe('running')
    expect((await reader.read()).session?.id).toBe('session-1')
    time.wallTime+=2500; time.monotonicTime+=2500
    await engine.dispatch({type:'pause',sessionId:'session-1',generation:1})
    expect(await reader.read()).toEqual({session:null,active:null,recovery:null})
    time.wallTime+=10_000; time.monotonicTime+=10_000
    await engine.dispatch({type:'resume',taskId:'task-1'})
    time.wallTime+=1000; time.monotonicTime+=1000
    await engine.dispatch({type:'pause',sessionId:'session-2',generation:1})
    const saved=await history()
    expect(saved.map(s => [s.id,s.startedAt,s.endedAt,s.endReason])).toEqual([
      ['session-1',1000,3500,'userPaused'],['session-2',13500,14500,'userPaused'],
    ])
    expect(saved.reduce((sum,s)=>sum+s.endedAt!-s.startedAt,0)).toBe(3500)
    expect((await tasks.list())[0]).toMatchObject({status:'ready',notes:'Keep notes'})
  })
  it('rejects double-start, nonexistent tasks and Resume without ended history', async () => {
    const {engine,history}=await setup()
    await expect(engine.dispatch({type:'start',taskId:'missing'})).rejects.toMatchObject({code:'validation'})
    await expect(engine.dispatch({type:'resume',taskId:'task-1'})).rejects.toMatchObject({code:'validation'})
    await engine.dispatch({type:'start',taskId:'task-1'})
    await expect(engine.dispatch({type:'start',taskId:'task-1'})).rejects.toMatchObject({code:'conflict'})
    expect(await history()).toHaveLength(1)
  })
  it.each(['complete','archive'] as const)('rejects %s before starting a removed task', async action => {
    const {engine,tasks,history}=await setup()
    await tasks[action]((await tasks.list())[0])
    await expect(engine.dispatch({type:'start',taskId:'task-1'})).rejects.toMatchObject({code:'validation'})
    expect(await history()).toEqual([])
  })
  it('rejects repeated Pause and stale identity or generation after Resume', async () => {
    const {engine,reader}=await setup()
    await engine.dispatch({type:'start',taskId:'task-1'})
    await expect(engine.dispatch({type:'pause',sessionId:'session-1',generation:2})).rejects.toMatchObject({code:'staleCommand'})
    await engine.dispatch({type:'pause',sessionId:'session-1',generation:1})
    await expect(engine.dispatch({type:'pause',sessionId:'session-1',generation:1})).rejects.toMatchObject({code:'staleCommand'})
    await engine.dispatch({type:'resume',taskId:'task-1'})
    await expect(engine.dispatch({type:'pause',sessionId:'session-1',generation:1})).rejects.toMatchObject({code:'staleCommand'})
    expect((await reader.read()).session?.id).toBe('session-2')
  })
  it('aborted creation rolls back session, marker and recovery before publishing success', async () => {
    const {engine,reader,history}=await setup()
    const original=IDBObjectStore.prototype.add
    vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,value,key) {
      const request=key===undefined ? original.call(this,value) : original.call(this,value,key)
      if (this.name==='recovery') this.transaction.abort()
      return request
    })
    const before=engine.getSnapshot()
    await expect(engine.dispatch({type:'start',taskId:'task-1'})).rejects.toMatchObject({code:'storageUnavailable'})
    expect(engine.getSnapshot()).toBe(before)
    expect(await history()).toEqual([])
    expect(await reader.read()).toEqual({session:null,active:null,recovery:null})
    vi.restoreAllMocks()
    expect((await engine.dispatch({type:'start',taskId:'task-1'})).mode).toBe('running')
  })
  it('aborted Pause preserves the open session, marker and evidence', async () => {
    const {engine,reader,time}=await setup()
    await engine.dispatch({type:'start',taskId:'task-1'})
    const before=engine.getSnapshot(); const persisted=await reader.read()
    const original=IDBObjectStore.prototype.delete
    vi.spyOn(IDBObjectStore.prototype,'delete').mockImplementation(function(this:IDBObjectStore,key) {
      const request=original.call(this,key)
      if (this.name==='recovery') this.transaction.abort()
      return request
    })
    time.wallTime+=1000; time.monotonicTime+=1000
    await expect(engine.dispatch({type:'pause',sessionId:'session-1',generation:1})).rejects.toMatchObject({code:'storageUnavailable'})
    expect(engine.getSnapshot()).toBe(before)
    expect(await reader.read()).toEqual(persisted)
    vi.restoreAllMocks()
    expect((await engine.dispatch({type:'pause',sessionId:'session-1',generation:1})).mode).toBe('idle')
  })
  it('simultaneous independent handlers cannot commit two open sessions', async () => {
    const {commands,database,history}=await setup()
    const other=new IndexedDBSessionCommands(database,()=> 'other-session',()=> 'UTC')
    const results=await Promise.allSettled([
      commands.commit({type:'start',taskId:'task-1'},{ownerId:'owner-1',clock:{wallTime:1000,monotonicTime:1}}),
      other.commit({type:'start',taskId:'task-1'},{ownerId:'owner-2',clock:{wallTime:1000,monotonicTime:1}}),
    ])
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
    expect((await history()).filter(s=>s.endedAt===null)).toHaveLength(1)
  })
  it('another owner cannot end the active session', async () => {
    const {engine,commands,reader}=await setup()
    await engine.dispatch({type:'start',taskId:'task-1'})
    await expect(commands.commit({type:'pause',sessionId:'session-1',generation:1},{ownerId:'other-owner',clock:{wallTime:2000,monotonicTime:1000}})).rejects.toMatchObject({code:'conflict'})
    expect((await reader.read()).session?.endedAt).toBeNull()
  })
  it('blocks task completion/archive while a session is open without losing task data', async () => {
    const {engine,tasks}=await setup()
    await engine.dispatch({type:'start',taskId:'task-1'})
    const task=(await tasks.list())[0]
    await expect(tasks.complete(task)).rejects.toThrow('Pause this task')
    await expect(tasks.archive(task)).rejects.toThrow('Pause this task')
    expect((await tasks.list())[0]).toEqual(task)
    await engine.dispatch({type:'pause',sessionId:'session-1',generation:1})
    await tasks.complete(task)
    expect((await tasks.list())[0].status).toBe('completed')
  })
  it('prevents overlap with closed history after a backward start boundary', async () => {
    const {engine,time,history}=await setup()
    await engine.dispatch({type:'start',taskId:'task-1'})
    time.wallTime=2000; time.monotonicTime=1100
    await engine.dispatch({type:'pause',sessionId:'session-1',generation:1})
    time.wallTime=1500
    await expect(engine.dispatch({type:'resume',taskId:'task-1'})).rejects.toMatchObject({code:'conflict'})
    expect(await history()).toHaveLength(1)
  })
})

describe('transactional Complete and Switch', () => {
  it('completes the active session and task at the same boundary', async () => {
    const {engine,time,tasks,history,reader}=await setup()
    await engine.dispatch({type:'start',taskId:'task-1'})
    time.wallTime+=2000; time.monotonicTime+=2000
    await engine.dispatch({type:'complete',taskId:'task-1',taskRevision:1,expectedSession:{sessionId:'session-1',generation:1}})
    expect((await tasks.list())[0]).toMatchObject({status:'completed',completedAt:3000,revision:2,notes:'Keep notes'})
    expect((await history())[0]).toMatchObject({endedAt:3000,endReason:'taskCompleted'})
    expect(await reader.read()).toEqual({session:null,active:null,recovery:null})
    expect(engine.getSnapshot().mode).toBe('idle')
  })
  it('switches at a shared boundary and rejects stale terminal actions', async () => {
    const {engine,time,database,history,tasks}=await setup()
    const task=(await tasks.list())[0]
    const db=await database.open()
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('tasks','readwrite')
      tx.objectStore('tasks').add({...task,id:'task-2',name:'Write'})
      tx.oncomplete=()=>resolve(); tx.onabort=()=>reject(tx.error)
    })
    await engine.dispatch({type:'start',taskId:'task-1'})
    await expect(engine.dispatch({type:'switch',sessionId:'session-1',generation:1,taskId:'missing'})).rejects.toMatchObject({code:'validation'})
    time.wallTime+=1000; time.monotonicTime+=1000
    await engine.dispatch({type:'switch',sessionId:'session-1',generation:1,taskId:'task-2'})
    expect((await history()).map(s=>[s.taskId,s.startedAt,s.endedAt,s.endReason])).toEqual([
      ['task-1',1000,2000,'taskSwitched'],['task-2',2000,null,null],
    ])
    expect(engine.getSnapshot()).toMatchObject({mode:'running',elapsedMilliseconds:0})
    await expect(engine.dispatch({type:'complete',taskId:'task-1',taskRevision:1,expectedSession:{sessionId:'session-1',generation:1}})).rejects.toMatchObject({code:'staleCommand'})
    await engine.dispatch({type:'complete',taskId:'task-1',taskRevision:1,expectedSession:null})
    expect(engine.getSnapshot().records.session?.taskId).toBe('task-2')
    expect((await tasks.list()).find(t=>t.id==='task-2')?.status).toBe('ready')
  })
  it('rolls back completion if saving task status fails', async () => {
    const {engine,tasks,reader,time}=await setup()
    await engine.dispatch({type:'start',taskId:'task-1'})
    const before=engine.getSnapshot(); const persisted=await reader.read(); const task=(await tasks.list())[0]
    const original=IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,key) {
      const request=key===undefined ? original.call(this,value) : original.call(this,value,key)
      if(this.name==='tasks') this.transaction.abort()
      return request
    })
    time.wallTime+=1000; time.monotonicTime+=1000
    await expect(engine.dispatch({type:'complete',taskId:'task-1',taskRevision:1,expectedSession:{sessionId:'session-1',generation:1}})).rejects.toMatchObject({code:'storageUnavailable'})
    expect(engine.getSnapshot()).toBe(before)
    expect(await reader.read()).toEqual(persisted)
    expect((await tasks.list())[0]).toEqual(task)
  })
  it('rolls back Switch when recovery replacement fails', async () => {
    const {engine,tasks,database,reader,history}=await setup()
    const db=await database.open(); const task=(await tasks.list())[0]
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('tasks','readwrite');tx.objectStore('tasks').add({...task,id:'task-2'})
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)
    })
    await engine.dispatch({type:'start',taskId:'task-1'})
    const before=engine.getSnapshot(); const persisted=await reader.read()
    const original=IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,key) {
      const request=key===undefined ? original.call(this,value) : original.call(this,value,key)
      if(this.name==='recovery') this.transaction.abort()
      return request
    })
    await expect(engine.dispatch({type:'switch',sessionId:'session-1',generation:1,taskId:'task-2'})).rejects.toMatchObject({code:'storageUnavailable'})
    expect(engine.getSnapshot()).toBe(before)
    expect(await reader.read()).toEqual(persisted)
    expect(await history()).toHaveLength(1)
  })
  it('rejects stale task revisions and another owner completing active work', async () => {
    const {engine,commands}=await setup()
    await engine.dispatch({type:'start',taskId:'task-1'})
    await expect(engine.dispatch({type:'complete',taskId:'task-1',taskRevision:2,expectedSession:{sessionId:'session-1',generation:1}})).rejects.toMatchObject({code:'staleCommand'})
    await expect(commands.commit({type:'complete',taskId:'task-1',taskRevision:1,expectedSession:{sessionId:'session-1',generation:1}}, {ownerId:'other',clock:{wallTime:2000,monotonicTime:1000}})).rejects.toMatchObject({code:'conflict'})
  })
})

describe('cross-tab ownership checkpoints', () => {
  it('renews lease and checkpoint atomically without changing history or user confirmation', async () => {
    const {engine,time,reader,history}=await setup()
    await engine.dispatch({type:'start',taskId:'task-1'})
    time.wallTime+=15_000;time.monotonicTime+=15_000
    await engine.dispatch({type:'checkpoint',sessionId:'session-1',generation:1})
    const records=await reader.read()
    expect(records.active).toMatchObject({leaseExpiresAt:76_000,lastRuntimeCheckpointAt:16_000,ownerId:'owner-1',generation:1})
    expect(records.recovery).toMatchObject({lastRuntimeCheckpointAt:16_000,lastUserConfirmedAt:1000})
    expect((await history())[0]).toMatchObject({revision:1,endedAt:null})
    expect(engine.getSnapshot().elapsedMilliseconds).toBe(15_000)
  })
  it('rejects foreign, stale and expired renewals without transferring ownership', async () => {
    const {engine,commands,reader}=await setup()
    await engine.dispatch({type:'start',taskId:'task-1'})
    const command={type:'checkpoint' as const,sessionId:'session-1',generation:1}
    await expect(commands.commit(command,{ownerId:'other',clock:{wallTime:2000,monotonicTime:1000}})).rejects.toMatchObject({code:'conflict'})
    await expect(commands.commit({...command,generation:2},{ownerId:'owner-1',clock:{wallTime:2000,monotonicTime:1000}})).rejects.toMatchObject({code:'staleCommand'})
    await expect(commands.commit(command,{ownerId:'owner-1',clock:{wallTime:61_000,monotonicTime:60_100}})).rejects.toMatchObject({code:'recoveryRequired'})
    await expect(commands.commit({type:'pause',sessionId:'session-1',generation:1},{ownerId:'owner-1',clock:{wallTime:61_000,monotonicTime:60_100}})).rejects.toMatchObject({code:'recoveryRequired'})
    expect((await reader.read()).active).toMatchObject({ownerId:'owner-1',leaseExpiresAt:61_000,generation:1})
  })
  it('rolls back checkpoint and lease when saving evidence fails', async () => {
    const {engine,time,reader}=await setup()
    await engine.dispatch({type:'start',taskId:'task-1'})
    const persisted=await reader.read();const before=engine.getSnapshot()
    const original=IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,key) {
      const request=key===undefined ? original.call(this,value) : original.call(this,value,key)
      if(this.name==='recovery') this.transaction.abort()
      return request
    })
    time.wallTime+=15_000;time.monotonicTime+=15_000
    await expect(engine.dispatch({type:'checkpoint',sessionId:'session-1',generation:1})).rejects.toMatchObject({code:'storageUnavailable'})
    expect(await reader.read()).toEqual(persisted)
    expect(engine.getSnapshot()).toBe(before)
  })
  it('serializes a checkpoint racing a terminal action', async () => {
    const {engine,commands,reader}=await setup()
    await engine.dispatch({type:'start',taskId:'task-1'})
    const context={ownerId:'owner-1',clock:{wallTime:2000,monotonicTime:1100}}
    await Promise.all([
      commands.commit({type:'checkpoint',sessionId:'session-1',generation:1},context),
      commands.commit({type:'pause',sessionId:'session-1',generation:1},context),
    ])
    expect(await reader.read()).toEqual({session:null,active:null,recovery:null})
    await expect(commands.commit({type:'checkpoint',sessionId:'session-1',generation:1},context)).rejects.toMatchObject({code:'staleCommand'})
  })
})

describe('expired owner reconciliation', () => {
  it('follows a live owner then requires recovery on expiry without rewriting history', async () => {
    const {engine,reader,commands,time,history}=await setup()
    await engine.dispatch({type:'start',taskId:'task-1'})
    const follower=new SessionEngine(reader,{sample:()=>({...time})},'owner-2',commands)
    expect((await follower.reconcile()).mode).toBe('following')
    time.wallTime=61_000;time.monotonicTime=60_100
    expect((await follower.reconcile()).mode).toBe('recoveryRequired')
    expect((await engine.observeClock()).mode).toBe('recoveryRequired')
    await expect(follower.dispatch({type:'start',taskId:'task-1'})).rejects.toMatchObject({code:'recoveryRequired'})
    expect((await reader.read()).active?.ownerId).toBe('owner-1')
    expect((await history())[0].endedAt).toBeNull()
  })
})
