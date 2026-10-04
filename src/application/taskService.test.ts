import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { TaskService } from './taskService'
import { IndexedDBTaskRepository } from '../persistence/taskRepository'
import { initialTaskDefaults, validateTask } from '../domain/task'
import type { TaskInput } from '../domain/task'

const input: TaskInput = { name: '  Read a book  ', type: 'reading', notes: 'Chapter 1', previousHours: 0,
  confirmation: { enabled: true, intervalMinutes: 30, inactivityMinutes:10, graceMinutes: 0 } }
function setup() {
  const factory = new IDBFactory()
  const repository = new IndexedDBTaskRepository(factory)
  let counter = 0
  const service = new TaskService(repository, () => 1000 + counter, () => `task-${++counter}`)
  return { factory, repository, service }
}
describe('task validation', () => {
  it('trims names, accepts zero previous hours and permits zero grace', () => {
    expect(validateTask(input).name).toBe('Read a book')
    expect(validateTask(input).previousHours).toBe(0)
  })
  it.each([' ', 'x'.repeat(201)])('rejects invalid name %j', name => {
    expect(() => validateTask({ ...input, name })).toThrow('task name')
  })
  it.each([-1, NaN, Infinity])('rejects invalid hours %s', previousHours => {
    expect(() => validateTask({ ...input, previousHours })).toThrow('hours')
  })
  it.each([0, -1, NaN, Infinity])('rejects invalid enabled interval %s', intervalMinutes => {
    expect(() => validateTask({ ...input, confirmation: { ...input.confirmation, intervalMinutes } })).toThrow('confirmation interval')
  })
  it('rejects negative grace', () => {
    expect(() => validateTask({ ...input, confirmation: { ...input.confirmation, graceMinutes: -1 } })).toThrow()
  })
})
describe('persisted task lifecycle', () => {
  it('restores all fields using a new repository, and allows duplicate names', async () => {
    const {factory, service} = setup()
    await service.create(input); await service.create(input)
    const records = await new IndexedDBTaskRepository(factory).list()
    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({name: 'Read a book', notes: 'Chapter 1', status: 'ready', previousHours: 0, confirmation: input.confirmation})
    expect(records[0].id).not.toBe(records[1].id)
  })
  it('edits, completes and archives while preserving completion timestamp and contents', async () => {
    const {service} = setup(); await service.create(input)
    let task = (await service.list())[0]
    await service.edit(task, { ...input, previousHours: 63, notes: 'Updated' })
    task = (await service.list())[0]; await service.complete(task)
    task = (await service.list())[0]
    expect(task.completedAt).not.toBeNull()
    const completedAt = task.completedAt
    await expect(service.complete(task)).rejects.toThrow('Only active')
    await service.archive(task)
    task = (await service.list())[0]
    expect(task).toMatchObject({status: 'archived', completedAt, notes: 'Updated', previousHours: 63})
    expect(task.archivedAt).not.toBeNull()
    await expect(service.edit(task, input)).rejects.toThrow('Archived')
  })
  it('rejects stale revisions instead of overwriting another edit', async () => {
    const {service} = setup(); await service.create(input)
    const task = (await service.list())[0]
    await service.edit(task, {...input, name: 'New name'})
    await expect(service.archive(task)).rejects.toThrow('another tab')
    expect((await service.list())[0].name).toBe('New name')
  })
  it('copies defaults; later defaults changes never rewrite existing tasks', async () => {
    const {repository} = setup()
    const defaults = structuredClone(initialTaskDefaults)
    let id = 0
    const service = new TaskService(repository, () => 10, () => String(++id), defaults)
    await service.create({...input, confirmation: service.creationDefaults().reading})
    defaults.reading.intervalMinutes = 60
    await service.create({...input, confirmation: service.creationDefaults().reading})
    const tasks = await service.list()
    expect(tasks.map(t => t.confirmation.intervalMinutes)).toEqual([30, 60])
    const copy = service.creationDefaults(); copy.reading.intervalMinutes = 90
    expect(service.creationDefaults().reading.intervalMinutes).toBe(60)
  })
  it('rejects duplicate identity and preserves the first record', async () => {
    const {repository, service} = setup(); await service.create(input)
    const task = (await service.list())[0]
    await expect(repository.insert({...task, name: 'Must not replace'})).rejects.toThrow('not saved')
    expect((await service.list())[0].name).toBe('Read a book')
  })
  it('does not report a failed persistence operation as success', async () => {
    const {repository} = setup()
    const failing = new TaskService({list: () => repository.list(), insert: async () => {throw new Error('Storage full')}, update: repository.update.bind(repository)})
    await expect(failing.create(input)).rejects.toThrow('Storage full')
    expect(await repository.list()).toEqual([])
  })
})
