import { test, expect } from '@playwright/test'

test('real browser upgrades V1 tasks without changing their data', async ({page}) => {
  // Start on a same-origin static asset so the app cannot upgrade before the fixture exists.
  await page.goto('/favicon.svg')
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve,reject) => {
      const request = indexedDB.open('manage-my-time',1)
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('tasks',{keyPath:'id'})
        store.createIndex('status','status')
      }
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve,reject) => {
      const tx = db.transaction('tasks','readwrite')
      tx.objectStore('tasks').add({id:'fixture',name:'Existing V1 task',type:'reading',status:'completed',notes:'Do not lose my notes',
        progressPercent:63,confirmation:{enabled:true,intervalMinutes:45, inactivityMinutes:10,graceMinutes:2},createdAt:1000,updatedAt:2000,completedAt:2000,archivedAt:null,revision:2})
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error)
    })
    db.close()
  })
  await page.goto('/')
  await page.getByRole('button',{name:/^Completed/}).click()
  await expect(page.getByRole('heading',{name:'Existing V1 task'})).toBeVisible()
  await expect(page.getByText('Do not lose my notes')).toBeVisible()
  await expect(page.getByText('Hours worked: 00:00:00')).toBeVisible()
  const schema = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('manage-my-time'); request.onsuccess = () => resolve(request.result)
    })
    const snapshot = {version:db.version, stores:Array.from(db.objectStoreNames)}; db.close(); return snapshot
  })
  expect(schema).toEqual({version:4, stores:['activeSession','recovery','tasks','workSessions']})
  await page.reload()
  await page.getByRole('button',{name:/^Completed/}).click()
  await expect(page.getByRole('heading',{name:'Existing V1 task'})).toBeVisible()
})
