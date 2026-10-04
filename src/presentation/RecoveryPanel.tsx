import { useState } from 'react'
import type { SessionSnapshot } from '../application/sessionEngine'
import type { RecoveryResolution } from '../domain/sessionStore'
import { suggestedRecoveryEnd } from '../domain/sessionRecovery'
import { formatDuration } from './sessionDisplay'

function localInput(timestamp:number):string {
  const date = new Date(timestamp)
  const pad = (value:number) => String(value).padStart(2,'0')
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function RecoveryPanel({snapshot,busy,onRecover}: {snapshot:SessionSnapshot;busy:boolean;onRecover:(resolution:RecoveryResolution)=>Promise<void>}) {
  const session = snapshot.records.session!
  const evidence = snapshot.records.recovery
  const suggested = suggestedRecoveryEnd(session,evidence)
  const [endTime,setEndTime] = useState(() => localInput(Math.ceil(suggested / 1000) * 1000))
  const [discard,setDiscard] = useState(false)
  const [error,setError] = useState('')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const displayTime = (value:number) => new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'medium',timeZone:timezone}).format(value)
  async function resolve(resolution:RecoveryResolution) {
    setError('')
    try { await onRecover(resolution) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Recovery was not saved. Retry.') }
  }
  return <div className="recovery-note">
    <h3>Resolve interrupted tracking</h3>
    <p>Your session is saved, but the app cannot verify work during the interruption. Choose where it ended to unlock tracking again.</p>
    {evidence && <p>Last activity or confirmation: {displayTime(Math.max(evidence.lastActivityAt ?? evidence.lastUserConfirmedAt,evidence.lastUserConfirmedAt))}<br/>Last runtime checkpoint: {displayTime(evidence.lastRuntimeCheckpointAt)} <span className="hint">(app was running; this does not prove work)</span></p>}
    <p>Suggested end: <strong>{displayTime(suggested)}</strong><br/>This keeps <strong>{formatDuration(suggested-session.startedAt)}</strong> from this session. {evidence?.pendingConfirmation ? 'The pending prompt’s cutoff excludes inactivity and grace.' : 'The suggestion uses the last recorded activity or confirmation.'}</p>
    <div className="tracking-actions"><button className="primary" disabled={busy} onClick={() => {void resolve({type:'end',endedAt:suggested})}}>End at suggested time</button></div>
    <form onSubmit={event => {
      event.preventDefault()
      const endedAt = new Date(endTime).getTime()
      if (!Number.isFinite(endedAt)) {setError('Choose a valid date and time.');return}
      void resolve({type:'end',endedAt})
    }}>
      <label>I worked until (local time · {timezone})<input type="datetime-local" step="1" min={localInput(Math.ceil(session.startedAt/1000)*1000)} required value={endTime} disabled={busy} onChange={event => setEndTime(event.target.value)} /></label>
      <p className="hint">Use your actual end time if you continued working. It must fall between the session start and now.</p>
      <button type="submit" disabled={busy}>Save end time</button>
    </form>
    <div className="tracking-actions"><button disabled={busy} onClick={() => setDiscard(true)}>Discard session</button></div>
    {discard && <div className="discard-confirmation" role="group" aria-label="Confirm session discard"><p>Discard this interrupted session? Its hours will not be recorded. Previously worked hours and other sessions stay saved.</p><div className="tracking-actions"><button disabled={busy} onClick={() => {void resolve({type:'discard'})}}>Confirm discard</button><button disabled={busy} onClick={() => setDiscard(false)}>Keep session</button></div></div>}
    {error && <p className="error" role="alert">{error}</p>}
  </div>
}
