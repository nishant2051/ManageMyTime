import { useEffect, useRef, useState } from 'react'
import type { TaskDefaults, TaskInput, TaskType, WorkTask } from '../domain/task'
import { taskTypes, typeLabels } from '../domain/task'

interface Props {
  task: WorkTask | null
  defaults: TaskDefaults
  onSave(input: TaskInput): Promise<void>
  onDismiss(): void
}
export function TaskEditor({ task, defaults, onSave, onDismiss }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(task?.name ?? '')
  const [type, setType] = useState<TaskType>(task?.type ?? 'active')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [hours, setHours] = useState(task?.previousHours.toString() ?? '')
  const policy = task?.confirmation ?? defaults.active
  const [enabled, setEnabled] = useState(policy.enabled)
  const [interval, setInterval] = useState(String(policy.intervalMinutes))
  const [inactivity, setInactivity] = useState(String(policy.inactivityMinutes))
  const [grace, setGrace] = useState(String(policy.graceMinutes))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    nameInput.current?.focus()
    return () => element.close()
  }, [])
  function selectType(value: TaskType) {
    setType(value)
    // Existing tasks keep their policy; newly created tasks receive type defaults.
    if (!task) {
      const next = defaults[value]
      setEnabled(next.enabled); setInterval(String(next.intervalMinutes)); setGrace(String(next.graceMinutes)); setInactivity(String(next.inactivityMinutes))
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      await onSave({ name, type, notes, previousHours: hours.trim() === '' ? 0 : Number(hours),
        confirmation: { enabled, inactivityMinutes: inactivity === '' ? NaN : Number(inactivity), intervalMinutes: interval === '' ? NaN : Number(interval), graceMinutes: grace === '' ? NaN : Number(grace) } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Task was not saved. Please retry.')
    } finally { setSaving(false) }
  }
  return (
    <dialog ref={dialog} aria-labelledby="editor-title" onCancel={event => { event.preventDefault(); if (!saving) onDismiss() }}>
      <form onSubmit={submit}>
        <div className="editor-heading"><h2 id="editor-title">{task ? 'Edit task' : 'Create task'}</h2><button type="button" className="quiet" onClick={onDismiss} disabled={saving}>Cancel</button></div>
        <fieldset disabled={saving} className="editor-fields">
          <label>Task name<input ref={nameInput} name="name" value={name} onChange={e => setName(e.target.value)} required autoComplete="off" /></label>
          <label>Task type<select value={type} onChange={e => selectType(e.target.value as TaskType)}>{taskTypes.map(value => <option key={value} value={value}>{typeLabels[value]}</option>)}</select></label>
          <label>Notes <span className="optional">(optional)</span><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></label>
          <label>Previously worked hours <span className="optional">(optional)</span><input type="number" min="0" step="any" value={hours} onChange={e => setHours(e.target.value)} /></label>
          <p className="hint">Enter hours worked before using this tracker. New sessions add to these hours automatically.</p>
          <details>
            <summary>Confirmation settings</summary>
            <p className="hint">Presence checks run while tracking. Inactivity refers to interactions in this app; it cannot detect work in other applications.</p>
            <label className="checkbox-label"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Enable periodic confirmation</label>
            <div className="form-columns">
              <label>Periodic interval (minutes)<input type="number" min={enabled ? '0.01' : '0'} step="any" required value={interval} onChange={e => setInterval(e.target.value)} /></label>
              <label>Inactivity interval (minutes)<input type="number" min="0.01" step="any" required value={inactivity} onChange={e => setInactivity(e.target.value)} /></label>
              <label>Grace period (minutes)<input type="number" min="0" step="any" required value={grace} onChange={e => setGrace(e.target.value)} /></label>
            </div>
            <p className="hint">Periodic checks ask regardless of activity. Inactivity checks ask after no detected activity. Grace is the time allowed to answer. If unanswered, recorded time ends at the last activity or confirmation; inactivity and grace time are excluded.</p>
          </details>
        </fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="editor-footer"><button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : task ? 'Save changes' : 'Create task'}</button></div>
      </form>
    </dialog>
  )
}
