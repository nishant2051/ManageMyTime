import { TaskService } from '../application/taskService'
import { IndexedDBTaskRepository } from '../persistence/taskRepository'

export interface AppEnvironment {
  readonly appName: string
  readonly tasks: TaskService
}
export function createAppEnvironment(): AppEnvironment {
  return Object.freeze({ appName: 'ManageMyTime', tasks: new TaskService(new IndexedDBTaskRepository()) })
}
