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
  const [progress, setProgress] = useState(task?.progressPercent?.toString() ?? '')
  const policy = task?.confirmation ?? defaults.active
  const [enabled, setEnabled] = useState(policy.enabled)
  const [interval, setInterval] = useState(String(policy.intervalMinutes))
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
      setEnabled(next.enabled); setInterval(String(next.intervalMinutes)); setGrace(String(next.graceMinutes))
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      await onSave({ name, type, notes, progressPercent: progress.trim() === '' ? null : Number(progress),
        confirmation: { enabled, intervalMinutes: interval === '' ? NaN : Number(interval), graceMinutes: grace === '' ? NaN : Number(grace) } })
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
          <label>Progress (%) <span className="optional">(optional)</span><input type="number" min="0" max="100" step="1" value={progress} onChange={e => setProgress(e.target.value)} /></label>
          <details>
            <summary>Confirmation settings</summary>
            <p className="hint">Save your preferences for future reminders. Reminders are not available yet.</p>
            <label className="checkbox-label"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Enable periodic confirmation</label>
            <div className="form-columns">
              <label>Interval (minutes)<input type="number" min={enabled ? '0.01' : '0'} step="any" required value={interval} onChange={e => setInterval(e.target.value)} /></label>
              <label>Grace period (minutes)<input type="number" min="0" step="any" required value={grace} onChange={e => setGrace(e.target.value)} /></label>
            </div>
          </details>
        </fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="editor-footer"><button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : task ? 'Save changes' : 'Create task'}</button></div>
      </form>
    </dialog>
  )
}
