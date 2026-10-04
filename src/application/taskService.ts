import { initialTaskDefaults, validateTask } from '../domain/task'
import type { TaskDefaults, TaskInput, WorkTask } from '../domain/task'
import type { TaskRepository } from '../domain/taskRepository'

export class TaskService {
  constructor(
    private readonly repository: TaskRepository,
    private readonly now: () => number = Date.now,
    private readonly id: () => string = () => crypto.randomUUID(),
    private readonly defaults: TaskDefaults = initialTaskDefaults,
    private readonly completion?: (task: WorkTask) => Promise<void>,
  ) {}
  list() { return this.repository.list() }
  creationDefaults(): TaskDefaults { return structuredClone(this.defaults) }
  async create(input: TaskInput): Promise<void> {
    const values = validateTask(input)
    const timestamp = this.now()
    await this.repository.insert({ ...values, id: this.id(), status: 'ready', createdAt: timestamp,
      updatedAt: timestamp, completedAt: null, archivedAt: null, revision: 1 })
  }
  async edit(task: WorkTask, input: TaskInput): Promise<void> {
    const values = validateTask(input)
    await this.repository.update(task.id, task.revision, current => {
      if (current.status === 'archived') throw new Error('Archived tasks cannot be edited.')
      return { ...current, ...values, updatedAt: this.now(), revision: current.revision + 1 }
    })
  }
  async complete(task: WorkTask): Promise<void> {
    if (this.completion) return this.completion(task)
    await this.repository.update(task.id, task.revision, current => {
      if (current.status !== 'ready') throw new Error('Only active tasks can be completed.')
      const timestamp = this.now()
      return { ...current, status: 'completed', completedAt: timestamp, updatedAt: timestamp, revision: current.revision + 1 }
    })
  }
  async archive(task: WorkTask): Promise<void> {
    await this.repository.update(task.id, task.revision, current => {
      if (current.status === 'archived') throw new Error('This task is already archived.')
      const timestamp = this.now()
      return { ...current, status: 'archived', archivedAt: timestamp, updatedAt: timestamp, revision: current.revision + 1 }
    })
  }
}
