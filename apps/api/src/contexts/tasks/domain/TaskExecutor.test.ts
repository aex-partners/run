import { describe, it, expect } from 'vitest'
import { TaskExecutor } from '@/contexts/tasks/domain/TaskExecutor'

describe('TaskExecutor', () => {
  it.each(['ai', 'human'])('parses the valid executor %s', (raw) => {
    const r = TaskExecutor.of(raw)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.value).toBe(raw)
  })

  it('rejects an unknown executor', () => {
    expect(TaskExecutor.of('robot').ok).toBe(false)
  })

  it('exposes ai() and human() constructors', () => {
    expect(TaskExecutor.ai().value).toBe('ai')
    expect(TaskExecutor.human().value).toBe('human')
  })

  it('compares by value with equals', () => {
    expect(TaskExecutor.ai().equals(TaskExecutor.ai())).toBe(true)
    expect(TaskExecutor.ai().equals(TaskExecutor.human())).toBe(false)
  })
})
