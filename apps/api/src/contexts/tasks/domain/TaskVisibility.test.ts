import { describe, it, expect } from 'vitest'
import { canAccessTask } from '@/contexts/tasks/domain/TaskVisibility'
import { Task } from '@/contexts/tasks/domain/Task'
import { TaskId } from '@/contexts/tasks/domain/ids'
import { TaskKind } from '@/contexts/tasks/domain/TaskKind'
import { TaskExecutor } from '@/contexts/tasks/domain/TaskExecutor'
import { TaskType } from '@/contexts/tasks/domain/TaskType'

const makeTask = (createdBy: string): Task => {
  const r = Task.create({
    id: TaskId.of('t1'),
    title: 'Test',
    description: null,
    kind: TaskKind.task(),
    executor: TaskExecutor.human(),
    type: TaskType.inference(),
    createdBy,
    conversationId: null,
    input: null,
    dueAt: null,
    parentTaskId: null,
    agentId: null,
    toolName: null,
    inputSchema: null,
    outputSchema: null,
    structuredInput: null,
    now: new Date('2026-01-01T00:00:00Z'),
  })
  if (!r.ok) throw new Error('task must create')
  return r.value
}

describe('canAccessTask', () => {
  it('grants the creator access', () => {
    const task = makeTask('creator')
    expect(canAccessTask(task, [], 'creator')).toBe(true)
  })

  it('grants an assignee access', () => {
    const task = makeTask('creator')
    expect(canAccessTask(task, ['alice', 'bob'], 'bob')).toBe(true)
  })

  it('denies a user who is neither creator nor assignee', () => {
    const task = makeTask('creator')
    expect(canAccessTask(task, ['alice', 'bob'], 'eve')).toBe(false)
  })

  it('denies when there are no assignees and the user is not the creator', () => {
    const task = makeTask('creator')
    expect(canAccessTask(task, [], 'eve')).toBe(false)
  })
})
