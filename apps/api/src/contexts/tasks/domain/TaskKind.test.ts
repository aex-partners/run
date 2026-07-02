import { describe, it, expect } from 'vitest'
import { TaskKind } from '@/contexts/tasks/domain/TaskKind'

describe('TaskKind', () => {
  it.each(['task', 'reminder', 'approval'])('parses the valid kind %s', (raw) => {
    const r = TaskKind.of(raw)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.value).toBe(raw)
  })

  it('rejects an unknown kind', () => {
    const r = TaskKind.of('nope')
    expect(r.ok).toBe(false)
  })

  it('exposes the task() constructor', () => {
    expect(TaskKind.task().value).toBe('task')
  })

  it('compares by value with equals', () => {
    expect(TaskKind.task().equals(TaskKind.task())).toBe(true)
    const approval = TaskKind.of('approval')
    expect(approval.ok && TaskKind.task().equals(approval.value)).toBe(false)
  })
})
