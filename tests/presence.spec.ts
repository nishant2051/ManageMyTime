import { test, expect, type Page } from '@playwright/test'

async function createPresenceTask(page:Page, {periodic = true, interval = '0.02', inactivity = '10', grace = '0.1'} = {}) {
  await page.getByRole('button',{name:'Create task',exact:true}).click()
  await page.getByLabel('Task name').fill('Presence test')
  await page.getByText('Confirmation settings',{exact:true}).click()
  await page.getByLabel('Enable periodic confirmation').setChecked(periodic)
  await page.getByLabel('Periodic interval (minutes)',{exact:true}).fill(interval)
  await page.getByLabel('Inactivity interval (minutes)',{exact:true}).fill(inactivity)
  await page.getByLabel('Grace period (minutes)',{exact:true}).fill(grace)
  await page.getByRole('dialog').getByRole('button',{name:'Create task',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Presence test',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Start Presence test',exact:true}).click()
}

test('periodic popup confirms continuity and sound can be enabled, tested and muted', async ({page}) => {
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play
    const played: {src:string;volume:number;paused:boolean;readyState:number}[] = []
    Object.assign(window,{chimePlayback:played})
    HTMLMediaElement.prototype.play = async function() {
      await original.call(this)
      played.push({src:this.currentSrc,volume:this.volume,paused:this.paused,readyState:this.readyState})
    }
  })
  await page.goto('/')
  await page.getByText('Presence alerts',{exact:true}).click()
  await page.getByRole('button',{name:'Enable sound',exact:true}).click()
  await expect(page.getByRole('button',{name:'Mute sound'})).toBeVisible()
  await page.getByRole('button',{name:'Test sound'}).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as {chimePlayback:unknown[]}).chimePlayback.length)).toBe(2)
  const playback = await page.evaluate(() => (window as unknown as {chimePlayback:{src:string;volume:number;paused:boolean;readyState:number}[]}).chimePlayback[0])
  expect(playback.src).toContain('/sounds/presence-chime.wav')
  expect(playback.volume).toBe(0.8)
  expect(playback.paused).toBe(false)
  expect(playback.readyState).toBeGreaterThanOrEqual(2)
  await createPresenceTask(page)
  const dialog = page.getByRole('dialog',{name:'Are you still working?'})
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('scheduled check, regardless of activity')
  await expect.poll(() => page.evaluate(() => (window as unknown as {chimePlayback:unknown[]}).chimePlayback.length)).toBe(3)
  await dialog.getByRole('button',{name:'I’m still working'}).click()
  await expect(dialog).not.toBeVisible()
  await page.getByRole('button',{name:'Pause Presence test',exact:true}).click()
  await expect(page.getByRole('region',{name:'Session history'})).toContainText('Paused')
  await page.getByRole('button',{name:'Mute sound'}).click()
  await expect(page.getByRole('button',{name:'Test sound'})).toBeDisabled()
})

test('unanswered inactivity prompt excludes inactivity and grace from saved hours', async ({page}) => {
  await page.goto('/')
  await createPresenceTask(page,{periodic:false,inactivity:'0.02',grace:'0.02'})
  const dialog = page.getByRole('dialog',{name:'Are you still working?'})
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('No activity has been detected')
  await expect(dialog).not.toBeVisible({timeout:6000})
  const history = page.getByRole('region',{name:'Session history'})
  await expect(history).toContainText('Confirmation timed out')
  await expect(page.getByText('Hours worked: 00:00:00',{exact:true})).toBeVisible()
  await page.reload()
  await expect(history).toContainText('Confirmation timed out')
  await expect(page.getByText('Hours worked: 00:00:00',{exact:true})).toBeVisible()
})

test('only the owner shows a popup and sends one notification; response closes it', async ({page,context}) => {
  await context.addInitScript(() => {
    const calls = {shown:0,closed:0}
    Object.assign(window,{notificationCalls:calls})
    class TestNotification {
      static permission = 'default'
      static async requestPermission() {this.permission='granted';return 'granted'}
      onclick: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor() {calls.shown++}
      close() {calls.closed++}
    }
    Object.defineProperty(window,'Notification',{value:TestNotification,configurable:true})
  })
  await page.goto('/')
  await page.getByText('Presence alerts',{exact:true}).click()
  await page.getByRole('button',{name:'Enable notifications'}).click()
  await expect(page.getByText(/Notifications: granted/)).toBeVisible()
  await createPresenceTask(page,{interval:'0.05',grace:'0.15'})
  const other = await context.newPage()
  await other.goto('/')
  const dialog = page.getByRole('dialog',{name:'Are you still working?'})
  await expect(dialog).toBeVisible({timeout:7000})
  await expect(other.getByRole('dialog',{name:'Are you still working?'})).not.toBeVisible()
  const notificationCalls = () => page.evaluate(() => (window as unknown as {notificationCalls:{shown:number;closed:number}}).notificationCalls)
  await expect.poll(async () => (await notificationCalls()).shown).toBe(1)
  await dialog.getByRole('button',{name:'Pause tracking'}).click()
  await expect(dialog).not.toBeVisible()
  await expect.poll(async () => (await notificationCalls()).closed).toBe(1)
  await expect(other.getByRole('region',{name:'Current session'})).toContainText('Ready when you are')
})

test('blocked notifications leave the in-app prompt available', async ({page}) => {
  await page.addInitScript(() => Object.defineProperty(window,'Notification',{value:{permission:'denied'}}))
  await page.goto('/')
  await page.getByText('Presence alerts',{exact:true}).click()
  await expect(page.getByText(/blocked — allow this site/)).toBeVisible()
  await expect(page.getByRole('button',{name:'Enable notifications'})).toBeDisabled()
  await createPresenceTask(page)
  const dialog = page.getByRole('dialog',{name:'Are you still working?'})
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button',{name:'Pause tracking'}).click()
  await expect(dialog).not.toBeVisible()
})

test('the presence popup fits a narrow viewport', async ({page}) => {
  await page.setViewportSize({width:375,height:812})
  await page.goto('/')
  await createPresenceTask(page,{grace:'0.2'})
  await expect(page.getByRole('dialog',{name:'Are you still working?'})).toBeVisible()
  await page.screenshot({path:'test-results/presence-mobile.png'})
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})


test('sound permission failure is visible and does not claim sound is enabled', async ({page}) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function() {return Promise.reject(new DOMException('Blocked','NotAllowedError'))}
  })
  await page.goto('/')
  await page.getByText('Presence alerts',{exact:true}).click()
  await page.getByRole('button',{name:'Enable sound',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('browser blocked sound')
  await expect(page.getByRole('button',{name:'Enable sound',exact:true})).toBeEnabled()
  await expect(page.getByRole('button',{name:'Test sound',exact:true})).toBeDisabled()
  await expect(page.getByText(/Sound: off/)).toBeVisible()
})
