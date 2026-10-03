import type { WorkTask } from './task'

export interface TaskRepository {
  list(): Promise<WorkTask[]>
  insert(task: WorkTask): Promise<void>
  update(id: string, expectedRevision: number, change: (task: WorkTask) => WorkTask): Promise<void>
}
