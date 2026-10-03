export const taskTypes = ['active', 'reading', 'custom'] as const
export type TaskType = typeof taskTypes[number]
export type TaskStatus = 'ready' | 'completed' | 'archived'
export interface ConfirmationPolicy {
  enabled: boolean
  intervalMinutes: number
  graceMinutes: number
}
export interface TaskInput {
  name: string
  type: TaskType
  notes: string
  progressPercent: number | null
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
  active: { enabled: false, intervalMinutes: 30, graceMinutes: 2 },
  reading: { enabled: true, intervalMinutes: 30, graceMinutes: 2 },
  custom: { enabled: false, intervalMinutes: 30, graceMinutes: 2 },
}
export const typeLabels: Record<TaskType, string> = {
  active: 'Active Work', reading: 'Reading / Passive', custom: 'Custom',
}
export function validateTask(input: TaskInput): TaskInput {
  const name = input.name.trim()
  if (!name || Array.from(name).length > 200) throw new Error('Use a task name between 1 and 200 characters.')
  if (!taskTypes.includes(input.type)) throw new Error('Choose a valid task type.')
  const progress = input.progressPercent
  if (progress !== null && (!Number.isInteger(progress) || progress < 0 || progress > 100)) {
    throw new Error('Progress must be a whole number between 0 and 100, or left blank.')
  }
  const { intervalMinutes, graceMinutes } = input.confirmation
  if (!Number.isFinite(intervalMinutes) || !Number.isFinite(graceMinutes) ||
      intervalMinutes < 0 || graceMinutes < 0 ||
      (input.confirmation.enabled && intervalMinutes <= 0)) {
    throw new Error('Use a positive confirmation interval when enabled and a nonnegative grace period.')
  }
  return { ...input, name, confirmation: { ...input.confirmation } }
}
