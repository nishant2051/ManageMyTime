import { test, expect } from '@playwright/test'

test('production engine persists Start/Pause/Resume without counting the pause gap', async ({page}) => {
  await page.goto('/')
  const outcome = await page.evaluate(async () => {
    const modulePath = '/src/app/environment.ts'
    const {createAppEnvironment} = await import(modulePath)
    const environment = createAppEnvironment()
    await environment.tasks.create({name:'Browser tracking task',type:'active',notes:'',previousHours:0,confirmation:{enabled:false,intervalMinutes:30, inactivityMinutes:10,graceMinutes:2}})
    const task = (await environment.tasks.list())[0]
    await environment.sessions.reconcile()
    const first = await environment.sessions.dispatch({type:'start',taskId:task.id})
    await environment.sessions.dispatch({type:'pause',sessionId:first.records.session.id,generation:first.records.active.generation})
    const second = await environment.sessions.dispatch({type:'resume',taskId:task.id})
    const idle = await environment.sessions.dispatch({type:'pause',sessionId:second.records.session.id,generation:second.records.active.generation})
    return {firstId:first.records.session.id,secondId:second.records.session.id,mode:idle.mode}
  })
  expect(outcome.firstId).not.toBe(outcome.secondId)
  expect(outcome.mode).toBe('idle')
  await page.reload()
  const saved = await page.evaluate(async () => {
    const db=await new Promise<IDBDatabase>(resolve => {
      const request=indexedDB.open('manage-my-time'); request.onsuccess=()=>resolve(request.result)
    })
    const result=await new Promise<{sessions:{id:string;startedAt:number;endedAt:number;endReason:string}[];markers:number;evidence:number}>((resolve,reject)=>{
      const tx=db.transaction(['workSessions','activeSession','recovery'],'readonly')
      const sessions=tx.objectStore('workSessions').getAll()
      const markers=tx.objectStore('activeSession').count()
      const evidence=tx.objectStore('recovery').count()
      tx.oncomplete=()=>resolve({sessions:sessions.result,markers:markers.result,evidence:evidence.result})
      tx.onabort=()=>reject(tx.error)
    })
    db.close(); return result
  })
  expect(saved.sessions).toHaveLength(2)
  expect(saved.sessions.every(s=>s.endedAt>=s.startedAt && s.endReason==='userPaused')).toBe(true)
  expect(saved.markers).toBe(0)
  expect(saved.evidence).toBe(0)
})

test('concurrent real browser tabs commit at most one open session', async ({page,context}) => {
  await page.goto('/')
  const taskId = await page.evaluate(async () => {
    const modulePath='/src/app/environment.ts'
    const {createAppEnvironment}=await import(modulePath)
    const env=createAppEnvironment()
    await env.tasks.create({name:'Concurrent task',type:'active',notes:'',previousHours:0,confirmation:{enabled:false,intervalMinutes:30, inactivityMinutes:10,graceMinutes:2}})
    return (await env.tasks.list())[0].id as string
  })
  const other=await context.newPage(); await other.goto('/')
  const outcomes=await Promise.all([page,other].map(tab => tab.evaluate(async id=>{
    const modulePath='/src/app/environment.ts'
    const {createAppEnvironment}=await import(modulePath)
    const env=createAppEnvironment(); await env.sessions.reconcile()
    try {await env.sessions.dispatch({type:'start',taskId:id}); return 'committed'}
    catch (error) {return error instanceof Error && 'code' in error ? String(error.code) : 'unexpected'}
  },taskId)))
  expect(outcomes.filter(value=>value==='committed')).toHaveLength(1)
  expect(outcomes.filter(value=>value==='conflict')).toHaveLength(1)
  const count = await page.evaluate(async () => {
    const db=await new Promise<IDBDatabase>(resolve=>{
      const request=indexedDB.open('manage-my-time'); request.onsuccess=()=>resolve(request.result)
    })
    const count=await new Promise<number>(resolve=>{
      const tx=db.transaction('workSessions','readonly'); const request=tx.objectStore('workSessions').getAll()
      tx.oncomplete=()=>resolve(request.result.filter(s=>s.endedAt===null).length)
    })
    db.close(); return count
  })
  expect(count).toBe(1)
})

test('production composition switches and completes active work atomically', async ({page}) => {
  await page.goto('/')
  const outcome=await page.evaluate(async ()=>{
    const modulePath='/src/app/environment.ts'
    const {createAppEnvironment}=await import(modulePath)
    const env=createAppEnvironment()
    for(const name of ['First','Second']) await env.tasks.create({name,type:'active',notes:'',previousHours:0,confirmation:{enabled:false,intervalMinutes:30, inactivityMinutes:10,graceMinutes:2}})
    const tasks=await env.tasks.list()
    const first=tasks.find((task:{name:string})=>task.name==='First')
    const second=tasks.find((task:{name:string})=>task.name==='Second')
    await env.sessions.reconcile()
    const started=await env.sessions.dispatch({type:'start',taskId:first.id})
    const switched=await env.sessions.dispatch({type:'switch',sessionId:started.records.session.id,generation:started.records.active.generation,taskId:second.id})
    await env.tasks.complete(second)
    const db=await new Promise<IDBDatabase>(resolve=>{
      const request=indexedDB.open('manage-my-time'); request.onsuccess=()=>resolve(request.result)
    })
    const history=await new Promise<{taskId:string;startedAt:number;endedAt:number;endReason:string}[]>(resolve=>{
      const tx=db.transaction('workSessions','readonly');const request=tx.objectStore('workSessions').getAll()
      tx.oncomplete=()=>resolve(request.result)
    })
    db.close()
    return {history,firstId:first.id,secondId:second.id,switchAt:switched.records.session.startedAt,mode:env.sessions.getSnapshot().mode,tasks:await env.tasks.list()}
  })
  const first=outcome.history.find(s=>s.taskId===outcome.firstId)!
  const second=outcome.history.find(s=>s.taskId===outcome.secondId)!
  expect(first.endReason).toBe('taskSwitched')
  expect(first.endedAt).toBe(second.startedAt)
  expect(second.endReason).toBe('taskCompleted')
  expect(outcome.mode).toBe('idle')
  expect(outcome.tasks.find((task:{id:string})=>task.id===outcome.secondId)).toMatchObject({status:'completed',completedAt:second.endedAt})
})

test('live tabs follow committed changes and checkpoint renewal without taking ownership', async ({page,context}) => {
  await page.goto('/')
  const taskId=await page.evaluate(async ()=>{
    const modulePath='/src/app/environment.ts';const {createAppEnvironment}=await import(modulePath)
    const env=createAppEnvironment();Object.assign(window,{ownershipTest:env,stopOwnership:env.coordination.start()})
    await env.tasks.create({name:'Owned work',type:'active',notes:'',previousHours:0,confirmation:{enabled:false,intervalMinutes:30, inactivityMinutes:10,graceMinutes:2}})
    await env.sessions.reconcile();return (await env.tasks.list())[0].id as string
  })
  const other=await context.newPage();await other.goto('/')
  await other.evaluate(async ()=>{
    const modulePath='/src/app/environment.ts';const {createAppEnvironment}=await import(modulePath)
    const env=createAppEnvironment();Object.assign(window,{ownershipTest:env,stopOwnership:env.coordination.start()})
    await env.sessions.reconcile()
  })
  await page.evaluate(async id=>{
    const env=(window as unknown as {ownershipTest:import('../src/app/environment').AppEnvironment}).ownershipTest
    await env.sessions.dispatch({type:'start',taskId:id})
  },taskId)
  await expect.poll(()=>other.evaluate(()=> (window as unknown as {ownershipTest:import('../src/app/environment').AppEnvironment}).ownershipTest.sessions.getSnapshot().mode)).toBe('following')
  const renewed=await page.evaluate(async ()=>{
    const env=(window as unknown as {ownershipTest:import('../src/app/environment').AppEnvironment}).ownershipTest
    await env.coordination.refresh()
    return env.sessions.getSnapshot().records.active!.lastRuntimeCheckpointAt
  })
  await expect.poll(()=>other.evaluate(()=> (window as unknown as {ownershipTest:import('../src/app/environment').AppEnvironment}).ownershipTest.sessions.getSnapshot().records.active?.lastRuntimeCheckpointAt)).toBe(renewed)
  const rejection=await other.evaluate(async ()=>{
    const env=(window as unknown as {ownershipTest:import('../src/app/environment').AppEnvironment}).ownershipTest
    const snapshot=env.sessions.getSnapshot()
    try {await env.sessions.dispatch({type:'pause',sessionId:snapshot.records.session!.id,generation:snapshot.records.active!.generation});return 'accepted'}
    catch(error) {return error instanceof Error && 'code' in error ? String(error.code) : 'unexpected'}
  })
  expect(rejection).toBe('conflict')
  await page.evaluate(async ()=>{
    const env=(window as unknown as {ownershipTest:import('../src/app/environment').AppEnvironment}).ownershipTest
    const snapshot=env.sessions.getSnapshot()
    await env.sessions.dispatch({type:'pause',sessionId:snapshot.records.session!.id,generation:snapshot.records.active!.generation})
  })
  await expect.poll(()=>other.evaluate(()=> (window as unknown as {ownershipTest:import('../src/app/environment').AppEnvironment}).ownershipTest.sessions.getSnapshot().mode)).toBe('idle')
})
