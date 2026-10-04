import { RecoveryPanel } from './RecoveryPanel'
import type { RecoveryResolution } from '../domain/sessionStore'
import type { WorkTask } from '../domain/task'
import type { SessionSnapshot } from '../application/sessionEngine'
import type { WorkSession } from '../domain/workSession'
import { endedTotal, workedTotal, endReasonLabels, formatDuration } from './sessionDisplay'

function timestamp(value: number, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {dateStyle:'medium',timeStyle:'medium',timeZone:timezone}).format(value)
}

interface Props {
  snapshot: SessionSnapshot
  history: WorkSession[]
  tasks: WorkTask[]
  loading: boolean
  busy: boolean
  error: string
  onPause: () => void
  onComplete: (task: WorkTask) => void
  refreshing: boolean
  onRecover: (resolution:RecoveryResolution) => Promise<void>
  onRefresh: () => void
}

export function TrackingPanel({snapshot,history,tasks,loading,busy,error,onPause,onComplete,onRefresh,refreshing,onRecover}: Props) {
  const session = snapshot.records.session
  const task = tasks.find(task => task.id === session?.taskId)
  return <>
    <section className="tracking-panel" aria-labelledby="tracking-title">
      <div className="tracking-heading"><h2 id="tracking-title">Current session</h2><button className="quiet" onClick={onRefresh} disabled={busy || refreshing}>{refreshing ? 'Refreshing…' : 'Refresh tracking'}</button></div>
      <p className="hint">Refresh checks saved tracking state and updates history without restarting the timer.</p>
      {snapshot.mode === 'uninitialized' && <p>Loading tracking state…</p>}
      {snapshot.mode === 'idle' && <p className="tracking-idle">Ready when you are. Start a task below to track your work.</p>}
      {session && <>
        <p className="current-task">{task?.name ?? 'Task unavailable'}</p>
        <p className="session-state" role="status">{snapshot.mode === 'running' ? 'Tracking in this tab' : snapshot.mode === 'following' ? 'Tracking in another tab · Read-only here' : 'Tracking interrupted · Recovery required'}</p>
        <div className="timer" role="timer" aria-live="off" aria-label="Current session elapsed">{snapshot.elapsedMilliseconds === null ? 'Elapsed time unavailable' : formatDuration(snapshot.elapsedMilliseconds)}</div>
        <p className="session-detail">Started {timestamp(session.startedAt,session.timezone)} · {session.timezone}</p>
        {!loading && !error && <p className="session-detail">Total hours worked: {task ? formatDuration(workedTotal(task,history,snapshot)) : 'Unavailable'}</p>}
        {snapshot.mode === 'running' && <div className="tracking-actions"><button onClick={onPause} disabled={busy} aria-label={`Pause ${task?.name ?? 'session'}`}>Pause</button>{task && <button className="primary" disabled={busy} onClick={() => onComplete(task)} aria-label={`Done with ${task.name}`}>Done</button>}</div>}
        {snapshot.mode === 'following' && <p className="hint">Use the tab that started this session to pause, switch or finish it. If that tab was closed or reloaded, wait up to a minute for its ownership to expire, then refresh tracking to recover.</p>}
        {snapshot.mode === 'recoveryRequired' && <RecoveryPanel key={`${session.id}:${session.revision}`} snapshot={snapshot} busy={busy} onRecover={onRecover} />}
      </>}
      {error && <div className="error" role="alert"><p>{error}</p><button onClick={onRefresh} disabled={busy}>Retry tracking</button></div>}
      <p className="hint">Presence checks use the task’s periodic, inactivity and grace settings. Interrupted timing requires recovery.</p>
    </section>
  </>
}

export function SessionHistory({history,tasks,loading,error}: Pick<Props, 'history' | 'tasks' | 'loading' | 'error'>) {
  return <section className="session-history" aria-labelledby="history-title">
      <div className="tracking-heading"><h2 id="history-title">Session history</h2>{!loading && !error && <span>Recorded total: <strong>{formatDuration(endedTotal(history))}</strong></span>}</div>
      <p className="hint">Totals include ended sessions only. Open or unresolved intervals are excluded.</p>
      {loading && <p role="status">Loading session history…</p>}
      {!loading && !error && history.length === 0 && <p>No sessions yet. Your recorded work will appear here.</p>}
      <ol className="session-list">{history.map(item => <li key={item.id} className="session-row">
        <div><strong>{tasks.find(task => task.id === item.taskId)?.name ?? 'Task unavailable'}</strong><p className="session-detail">{timestamp(item.startedAt,item.timezone)} → {item.endedAt === null ? 'Not ended' : timestamp(item.endedAt,item.timezone)}<br/>{item.timezone}</p></div>
        <div className="session-result"><strong>{item.endedAt === null ? 'Duration pending' : formatDuration(item.endedAt-item.startedAt)}</strong><span>{item.endReason ? endReasonLabels[item.endReason] : 'Open session'}</span>{item.wasCorrected && <span>Corrected</span>}</div>
      </li>)}</ol>
    </section>
}
