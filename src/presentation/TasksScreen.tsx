import { PresencePanel } from './PresencePanel'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppEnvironment } from '../app/environment'
import type { TaskInput, TaskStatus, WorkTask } from '../domain/task'
import { typeLabels } from '../domain/task'
import { TrackingPanel, SessionHistory } from './TrackingPanel'
import { useSessionTracking } from './useSessionTracking'
import { workedTotal, formatDuration } from './sessionDisplay'
import type { RecoveryResolution, SessionCommand } from '../domain/sessionStore'
import { TaskEditor } from './TaskEditor'

const filters: {value: TaskStatus; label: string}[] = [
  {value: 'ready', label: 'Active'}, {value: 'completed', label: 'Completed'}, {value: 'archived', label: 'Archived'},
]
export function TasksScreen({ environment }: {environment: AppEnvironment}) {
  const [tasks, setTasks] = useState<WorkTask[]>([])
  const [filter, setFilter] = useState<TaskStatus>('ready')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [editor, setEditor] = useState<{task: WorkTask | null} | null>(null)
  const sequence = useRef({value: 0})
  const opener = useRef<HTMLButtonElement | null>(null)
  const tracking = useSessionTracking(environment)
  const session = tracking.snapshot.records.session
  const mode = tracking.snapshot.mode
  const canTrack = (mode === 'idle' || mode === 'running') && !tracking.loading && !tracking.error && !loading && !error
  const defaults = environment.tasks.creationDefaults()

  const reload = useCallback(async () => {
    const request = ++sequence.current.value
    setLoading(true)
    try {
      const records = await environment.tasks.list()
      if (request === sequence.current.value) { setTasks(records); setError('') }
    } catch (cause) {
      if (request === sequence.current.value) setError(cause instanceof Error ? cause.message : 'Tasks could not be loaded.')
    } finally { if (request === sequence.current.value) setLoading(false) }
  }, [environment])
  useEffect(() => {
    const counter = sequence.current
    // Reconcile other-tab updates on focus/visibility; database revisions guard edits.
    const refresh = () => { void reload() }
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    let sessionKey = ''
    const sessionChanged = () => {
      const state = environment.sessions.getSnapshot()
      const key = `${state.mode}:${state.records.session?.id ?? ''}`
      if (key !== sessionKey) { sessionKey = key; refresh() }
    }
    const unsubscribe = environment.sessions.subscribe(sessionChanged)
    refresh()
    return () => {
      unsubscribe()
      counter.value++
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [reload, environment])

  async function track(command: SessionCommand, taskId: string) {
    setBusy(taskId); setNotice(''); setError('')
    try {
      await environment.sessions.dispatch(command)
      setNotice(command.type === 'pause' ? 'Session paused and saved.' : command.type === 'switch' ? 'Switched tasks. Previous session saved.' : 'Session started.')
      await tracking.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Session changes could not be saved.')
      // Reconcile stale/foreign state, but retain the original failed-save message.
      await environment.sessions.reconcile().catch(() => undefined)
    } finally { setBusy(null) }
  }
  async function recover(resolution:RecoveryResolution) {
    if (!session || mode !== 'recoveryRequired') throw new Error('Refresh tracking before recovering a session.')
    const active = tracking.snapshot.records.active
    setBusy(session.taskId); setNotice(''); setError('')
    try {
      await environment.sessions.dispatch({type:'recover',sessionId:session.id,sessionRevision:session.revision,
        expectedOwner:active ? {ownerId:active.ownerId,generation:active.generation,lastRuntimeCheckpointAt:active.lastRuntimeCheckpointAt} : null,resolution})
      setNotice(resolution.type === 'discard' ? 'Interrupted session discarded. You can start tracking again.' : 'Recovered session saved. Resume when you are ready.')
      await Promise.all([reload(),tracking.reload()])
    } catch (cause) {
      const current = await environment.sessions.reconcile().catch(() => environment.sessions.getSnapshot())
      if (current.mode !== 'recoveryRequired' || current.records.session?.id !== session.id || current.records.session.revision !== session.revision) {
        setError(cause instanceof Error ? cause.message : 'Recovery was not saved. Refresh tracking and retry.')
      }
      throw cause
    } finally { setBusy(null) }
  }
  function pause() {
    if (session && tracking.snapshot.records.active) void track({type:'pause',sessionId:session.id,generation:tracking.snapshot.records.active.generation},session.taskId)
  }
  function startTask(task: WorkTask) {
    const active = tracking.snapshot.records.active
    if (mode === 'running' && session && active) void track({type:'switch',sessionId:session.id,generation:active.generation,taskId:task.id},task.id)
    else void track({type:tracking.history.some(item => item.taskId === task.id && item.endedAt !== null && item.creationSource === 'tracked') ? 'resume' : 'start',taskId:task.id},task.id)
  }
  function openEditor(task: WorkTask | null, button: HTMLButtonElement) {
    opener.current = button; setNotice(''); setEditor({task})
  }
  useEffect(() => {
    if (!editor && !loading && opener.current) {
      opener.current.focus()
      opener.current = null
    }
  }, [editor, loading])
  function closeEditor() { setEditor(null) }
  async function save(input: TaskInput) {
    if (editor?.task) await environment.tasks.edit(editor.task, input)
    else await environment.tasks.create(input)
    setNotice(editor?.task ? 'Changes saved.' : 'Task created.')
    closeEditor()
    await reload()
  }
  async function action(task: WorkTask, kind: 'complete' | 'archive') {
    setBusy(task.id); setNotice(''); setError('')
    try {
      await environment.tasks[kind](task)
      setNotice(kind === 'complete' ? 'Task completed.' : 'Task archived. Its details are preserved.')
      await Promise.all([reload(),tracking.reload()])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Changes could not be saved.') }
    finally { setBusy(null) }
  }
  const shown = tasks.filter(task => task.status === filter).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
  return (
    <div className="app-shell">
      <header className="app-header"><span className="brand-icon" aria-hidden="true">m</span><span className="brand-name">{environment.appName}</span><span className="version">Your personal workspace</span></header>
      <main className="tasks-main">
        <section className="tasks-workspace" aria-labelledby="tasks-title">
          <div className="page-heading"><div><p className="eyebrow">Make room for what matters</p><h1 id="tasks-title">Tasks</h1><p className="intro">Keep your ongoing work in one place.</p></div><button className="primary" disabled={loading || !!error} onClick={e => openEditor(null, e.currentTarget)}>Create task</button></div>
          <TrackingPanel snapshot={tracking.snapshot} history={tracking.history} tasks={tasks} loading={tracking.loading} busy={busy !== null} error={error ? '' : tracking.error} onPause={pause} onComplete={task => {void action(task,'complete')}} refreshing={tracking.refreshing} onRecover={recover} onRefresh={() => {void tracking.refresh()}} />
          <PresencePanel environment={environment} snapshot={tracking.snapshot} tasks={tasks} />
          <div className="list-toolbar"><div className="filters" aria-label="Task filters">{filters.map(item => <button key={item.value} aria-pressed={filter === item.value} onClick={() => {setFilter(item.value); setNotice('')}}>{item.label} <span>{tasks.filter(task => task.status === item.value).length}</span></button>)}</div><button className="quiet" onClick={() => {void reload()}} disabled={loading}>Refresh list</button></div>
          <p className="status-message" role="status">{loading ? 'Loading tasks…' : notice}</p>
          {error && <div className="error" role="alert"><p>{error}</p><button onClick={() => {void reload()}}>Retry loading</button></div>}
          {!loading && !error && shown.length === 0 && <div className="empty-state"><h2>{filter === 'ready' ? 'Your next project starts here.' : `No ${filter} tasks yet.`}</h2><p>{filter === 'ready' ? 'Create a task for something you want to work on. Notes and previously worked hours are optional.' : `Tasks you ${filter === 'completed' ? 'complete' : 'archive'} will appear here.`}</p></div>}
          <ul className="task-list">{shown.map(task => <li key={task.id} className="task-card">
            <div className="task-content"><div className="task-meta"><span>{typeLabels[task.type]}</span><span className="task-state">{task.status === 'ready' ? 'Active' : task.status === 'completed' ? 'Completed' : 'Archived'}</span></div><h2>{task.name}</h2>{task.notes && <p className="task-notes">{task.notes}</p>}<div className="task-details"><span>{task.confirmation.enabled ? `Periodic confirmation: every ${task.confirmation.intervalMinutes} min` : 'Periodic confirmation: off'}</span><span>Inactivity check: after {task.confirmation.inactivityMinutes} min · Grace: {task.confirmation.graceMinutes} min</span>{!tracking.loading && !tracking.error && <span>Hours worked: {formatDuration(workedTotal(task,tracking.history,tracking.snapshot))}</span>}{task.completedAt && <span>Completed {new Date(task.completedAt).toLocaleDateString()}</span>}{task.archivedAt && <span>Archived {new Date(task.archivedAt).toLocaleDateString()}</span>}</div></div>
            {task.status !== 'archived' && <div className="task-actions">{task.status === 'ready' && session?.taskId !== task.id && <button className="primary" disabled={busy !== null || !canTrack} onClick={() => startTask(task)} aria-label={`${mode === 'running' ? 'Switch to' : tracking.history.some(item => item.taskId === task.id && item.endedAt !== null && item.creationSource === 'tracked') ? 'Resume' : 'Start'} ${task.name}`}>{mode === 'running' ? 'Switch to' : tracking.history.some(item => item.taskId === task.id && item.endedAt !== null && item.creationSource === 'tracked') ? 'Resume' : 'Start'}</button>}<button disabled={busy !== null} onClick={e => openEditor(task, e.currentTarget)} aria-label={`Edit ${task.name}`}>Edit</button>{task.status === 'ready' && <button disabled={busy !== null || mode === 'uninitialized' || mode === 'recoveryRequired' || (session?.taskId === task.id && mode !== 'running')} onClick={() => {void action(task, 'complete')}} aria-label={`Complete ${task.name}`}>Complete</button>}<button disabled={busy !== null || session?.taskId === task.id} onClick={() => {void action(task, 'archive')}} aria-label={`Archive ${task.name}`}>Archive</button></div>}
          </li>)}</ul>
          <SessionHistory history={tracking.history} tasks={tasks} loading={tracking.loading} error={tracking.error} />
          <aside className="storage-note"><strong>Saved in this browser.</strong> Tasks stay on this device and site. Clearing site data can remove them. Sessions stay here too. Resolve interrupted sessions above before starting again. Export is coming in a later step.</aside>
        </section>
      </main>
      {editor && <TaskEditor task={editor.task} defaults={defaults} onSave={save} onDismiss={closeEditor} />}
    </div>
  )
}
