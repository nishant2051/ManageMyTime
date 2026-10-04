import { useEffect, useRef, useState } from 'react'
import type { AppEnvironment } from '../app/environment'
import type { SessionSnapshot } from '../application/sessionEngine'
import type { WorkTask } from '../domain/task'
import { PresenceAlerts } from '../infrastructure/presenceAlerts'

export function PresencePanel({environment,snapshot,tasks}: {environment:AppEnvironment; snapshot:SessionSnapshot; tasks:WorkTask[]}) {
  const [alerts] = useState(() => new PresenceAlerts())
  const [sound, setSound] = useState(false)
  const [permission, setPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [soundBusy,setSoundBusy] = useState(false)
  const [soundStatus,setSoundStatus] = useState('')
  const [now,setNow] = useState(() => Date.now())
  const dialog = useRef<HTMLDialogElement>(null)
  const announced = useRef('')
  const prompt = snapshot.mode === 'running' ? snapshot.records.recovery?.pendingConfirmation : null
  const taskName = tasks.find(task => task.id === snapshot.records.session?.taskId)?.name ?? 'Current task'
  const seconds = prompt ? Math.max(0,Math.ceil((prompt.graceDeadlineAt - Math.max(now,prompt.dueAt)) / 1000)) : 0

  useEffect(() => {
    if (prompt) {
      if (!dialog.current?.open) dialog.current?.showModal()
      if (announced.current !== prompt.promptId) {
        announced.current = prompt.promptId
        setError(alerts.show(taskName,setError))
      }
    } else {
      dialog.current?.close()
      alerts.clear()
      announced.current = ''
    }
  }, [prompt, alerts, taskName])
  useEffect(() => () => alerts.clear(), [alerts])
  const promptId = prompt?.promptId
  useEffect(() => {
    if (!promptId) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [promptId])

  async function answer(value:'continue' | 'pause') {
    const active = snapshot.records.active
    if (!prompt || !active) return
    setBusy(true); setError('')
    try {
      await environment.sessions.dispatch({type:'answer',sessionId:prompt.sessionId,generation:prompt.generation,promptId:prompt.promptId,answer:value})
    } catch (error) { setError(error instanceof Error ? error.message : 'Your answer could not be saved. Retry.') }
    finally { setBusy(false) }
  }

  async function enableNotifications() {
    try { setPermission(await Notification.requestPermission()) }
    catch { setError('Notifications could not be enabled. Check browser permissions.') }
  }
  async function enableSound() {
    setSoundBusy(true); setSoundStatus('Starting chime…')
    try { await alerts.enableSound(); setSound(true); setError(''); setSoundStatus('Chime playback started. If you cannot hear it, check the tab is unmuted and your speaker volume/output.') }
    catch (error) { setSound(false); setSoundStatus(''); setError(error instanceof Error ? error.message : 'Sound unavailable.') }
    finally { setSoundBusy(false) }
  }
  async function testSound() {
    setSoundBusy(true); setSoundStatus('Starting chime…')
    try { await alerts.chime(); setError(''); setSoundStatus('Chime playback started. If you cannot hear it, check the tab is unmuted and your speaker volume/output.') }
    catch (error) { setSoundStatus(''); setError(error instanceof Error ? error.message : 'Sound unavailable.') }
    finally { setSoundBusy(false) }
  }
  return <>
    <details className="presence-settings">
      <summary>Presence alerts</summary>
      <p className="hint">Inactivity means no interaction in this app. Working in other applications may trigger a check; confirm to keep that time. Keep this tab open. Alerts may be delayed if the browser suspends it.</p>
      <div className="tracking-actions">
        <button disabled={permission === 'unsupported' || permission === 'granted' || permission === 'denied'} onClick={() => {void enableNotifications()}}>Enable notifications</button>
        <button disabled={soundBusy} onClick={() => {if (sound) { alerts.mute(); setSound(false); setSoundStatus('') } else void enableSound()}}>{sound ? 'Mute sound' : 'Enable sound'}</button>
        <button disabled={!sound || soundBusy} onClick={() => {void testSound()}}>Test sound</button>
      </div>
      <p className="hint">Notifications: {permission === 'denied' ? 'blocked — allow this site in browser settings' : permission}. Sound: {sound ? 'enabled for this visit' : 'off'}.</p>
      {soundStatus && <p className="hint" role="status">{soundStatus}</p>}
    </details>
    {error && !prompt && <p className="error" role="alert">{error}</p>}
    <dialog ref={dialog} aria-labelledby="presence-title" onCancel={event => event.preventDefault()}>
      <h2 id="presence-title">Are you still working?</h2>
      <p>{taskName}</p>
      <p>{prompt?.reason === 'periodic' ? 'This is your scheduled check, regardless of activity.' : 'No activity has been detected in this app.'}</p>
      <p role="timer" aria-live="off">Time to answer: {seconds} seconds</p>
      <p className="hint">Without an answer, tracking pauses at the last activity or confirmation. Inactivity and grace time won’t count.</p>
      <div className="tracking-actions"><button className="primary" disabled={busy || seconds === 0} onClick={() => {void answer('continue')}}>I’m still working</button><button disabled={busy || seconds === 0} onClick={() => {void answer('pause')}}>Pause tracking</button></div>
      {error && <p className="error" role="alert">{error}</p>}
    </dialog>
  </>
}
