import { describe, it, expect } from 'vitest'
import { TaskMapper, TaskRow } from '@/contexts/tasks/application/mappers/TaskMapper'
import { Task } from '@/contexts/tasks/domain/Task'
import { TaskId } from '@/contexts/tasks/domain/ids'
import { TaskKind } from '@/contexts/tasks/domain/TaskKind'
import { TaskExecutor } from '@/contexts/tasks/domain/TaskExecutor'
import { TaskType } from '@/contexts/tasks/domain/TaskType'

const kindOf = (raw: string): TaskKind => {
  const r = TaskKind.of(raw)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

interface Variant {
  id: string
  kind: TaskKind
  executor: TaskExecutor
  type: TaskType
}

const buildTask = (v: Variant): Task =>
  Task.rehydrate({
    id: TaskId.of(v.id),
    title: 'A round-trippable task',
    description: 'with a description',
    status: 'running',
    progress: 73,
    conversationId: 'conv-9',
    createdBy: 'creator-1',
    result: 'partial result',
    error: 'some error',
    input: '{"in":1}',
    scheduledAt: new Date('2026-03-01T10:00:00Z'),
    type: v.type,
    agentId: 'agent-7',
    toolName: 'tool-7',
    inputSchema: '{"a":1}',
    outputSchema: '{"b":2}',
    structuredInput: '{"c":3}',
    executor: v.executor,
    kind: v.kind,
    dueAt: new Date('2026-04-01T00:00:00Z'),
    snoozedUntil: new Date('2026-03-15T00:00:00Z'),
    parentTaskId: 'parent-7',
    approvalDecision: 'approved',
    createdAt: new Date('2026-02-01T00:00:00Z'),
    startedAt: new Date('2026-02-02T00:00:00Z'),
    completedAt: new Date('2026-02-03T00:00:00Z'),
  })

describe('TaskMapper', () => {
  it('round-trips a human approval / structured task (toPersistence -> toDomain)', () => {
    const original = buildTask({
      id: 'task-A',
      kind: kindOf('approval'),
      executor: TaskExecutor.human(),
      type: TaskType.structured(),
    })

    const row = TaskMapper.toPersistence(original)
    const back = TaskMapper.toDomain(row)

    expect(back.id.value).toBe('task-A')
    expect(back.title).toBe('A round-trippable task')
    expect(back.description).toBe('with a description')
    expect(back.status).toBe('running')
    expect(back.progress).toBe(73)
    expect(back.conversationId).toBe('conv-9')
    expect(back.createdBy).toBe('creator-1')
    expect(back.result).toBe('partial result')
    expect(back.error).toBe('some error')
    expect(back.input).toBe('{"in":1}')
    expect(back.scheduledAt).toEqual(new Date('2026-03-01T10:00:00Z'))
    expect(back.type.value).toBe('structured')
    expect(back.agentId).toBe('agent-7')
    expect(back.toolName).toBe('tool-7')
    expect(back.inputSchema).toBe('{"a":1}')
    expect(back.outputSchema).toBe('{"b":2}')
    expect(back.structuredInput).toBe('{"c":3}')
    expect(back.executor.value).toBe('human')
    expect(back.kind.value).toBe('approval')
    expect(back.dueAt).toEqual(new Date('2026-04-01T00:00:00Z'))
    expect(back.snoozedUntil).toEqual(new Date('2026-03-15T00:00:00Z'))
    expect(back.parentTaskId).toBe('parent-7')
    expect(back.approvalDecision).toBe('approved')
    expect(back.createdAt).toEqual(new Date('2026-02-01T00:00:00Z'))
    expect(back.startedAt).toEqual(new Date('2026-02-02T00:00:00Z'))
    expect(back.completedAt).toEqual(new Date('2026-02-03T00:00:00Z'))

    // The serialised row is stable across a second pass.
    expect(TaskMapper.toPersistence(back)).toEqual(row)
  })

  it('round-trips an ai task / inference task (different kind/executor/type)', () => {
    const original = buildTask({
      id: 'task-B',
      kind: kindOf('task'),
      executor: TaskExecutor.ai(),
      type: TaskType.inference(),
    })
    const row = TaskMapper.toPersistence(original)
    const back = TaskMapper.toDomain(row)

    expect(back.kind.value).toBe('task')
    expect(back.executor.value).toBe('ai')
    expect(back.type.value).toBe('inference')
    expect(TaskMapper.toPersistence(back)).toEqual(row)
  })

  it('round-trips a reminder task and preserves null optional fields', () => {
    const original = Task.rehydrate({
      id: TaskId.of('task-C'),
      title: 'Bare reminder',
      description: null,
      status: 'pending',
      progress: 0,
      conversationId: null,
      createdBy: 'creator-2',
      result: null,
      error: null,
      input: null,
      scheduledAt: null,
      type: TaskType.inference(),
      agentId: null,
      toolName: null,
      inputSchema: null,
      outputSchema: null,
      structuredInput: null,
      executor: TaskExecutor.human(),
      kind: kindOf('reminder'),
      dueAt: null,
      snoozedUntil: null,
      parentTaskId: null,
      approvalDecision: null,
      createdAt: new Date('2026-02-01T00:00:00Z'),
      startedAt: null,
      completedAt: null,
    })
    const row = TaskMapper.toPersistence(original)
    const back = TaskMapper.toDomain(row)

    expect(back.kind.value).toBe('reminder')
    expect(back.description).toBeNull()
    expect(back.scheduledAt).toBeNull()
    expect(back.dueAt).toBeNull()
    expect(back.approvalDecision).toBeNull()
    expect(back.completedAt).toBeNull()
    expect(TaskMapper.toPersistence(back)).toEqual(row)
  })

  it('throws when a persisted row carries an invalid kind', () => {
    const row = TaskMapper.toPersistence(
      buildTask({
        id: 'task-D',
        kind: kindOf('task'),
        executor: TaskExecutor.ai(),
        type: TaskType.inference(),
      }),
    )
    const corrupted = { ...row, kind: 'bogus' as TaskRow['kind'] }
    expect(() => TaskMapper.toDomain(corrupted)).toThrow(/TaskMapper.toDomain/)
  })
})
