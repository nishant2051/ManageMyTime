export const taskTypes = ['active', 'reading', 'custom'] as const
export type TaskType = typeof taskTypes[number]
export type TaskStatus = 'ready' | 'completed' | 'archived'
export interface ConfirmationPolicy {
  enabled: boolean
  intervalMinutes: number
  inactivityMinutes: number
  graceMinutes: number
}
export interface TaskInput {
  name: string
  type: TaskType
  notes: string
  previousHours: number
  confirmation: ConfirmationPolicy
}
export interface WorkTask extends TaskInput {
  id: string
  status: TaskStatus
  createdAt: number
  updatedAt: number
  completedAt: number | null
  archivedAt: number | null
  revision: number
}
export type TaskDefaults = Record<TaskType, ConfirmationPolicy>
export const initialTaskDefaults: TaskDefaults = {
  active: { enabled: false, intervalMinutes: 30, inactivityMinutes:10, graceMinutes: 2 },
  reading: { enabled: true, intervalMinutes: 30, inactivityMinutes:10, graceMinutes: 2 },
  custom: { enabled: false, intervalMinutes: 30, inactivityMinutes:10, graceMinutes: 2 },
}
export const typeLabels: Record<TaskType, string> = {
  active: 'Active Work', reading: 'Reading / Passive', custom: 'Custom',
}
export function validateTask(input: TaskInput): TaskInput {
  const name = input.name.trim()
  if (!name || Array.from(name).length > 200) throw new Error('Use a task name between 1 and 200 characters.')
  if (!taskTypes.includes(input.type)) throw new Error('Choose a valid task type.')
  if (!Number.isFinite(input.previousHours) || input.previousHours < 0 || !Number.isSafeInteger(Math.round(input.previousHours * 3600000))) {
    throw new Error('Previously worked hours must be a finite nonnegative number.')
  }
  const { intervalMinutes, inactivityMinutes, graceMinutes } = input.confirmation
  if (!Number.isFinite(inactivityMinutes) || inactivityMinutes <= 0 || !Number.isFinite(intervalMinutes) || !Number.isFinite(graceMinutes) ||
      intervalMinutes < 0 || graceMinutes < 0 ||
      (input.confirmation.enabled && intervalMinutes <= 0)) {
    throw new Error('Use a positive confirmation interval when enabled and a positive inactivity interval and a nonnegative grace period.')
  }
  return { ...input, name, confirmation: { ...input.confirmation } }
}
