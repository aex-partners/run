import { describe, it, expect } from 'vitest'
import { TaskType } from '@/contexts/tasks/domain/TaskType'

describe('TaskType', () => {
  it.each(['inference', 'structured'])('parses the valid type %s', (raw) => {
    const r = TaskType.of(raw)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.value).toBe(raw)
  })

  it('rejects an unknown type', () => {
    expect(TaskType.of('batch').ok).toBe(false)
  })

  it('exposes inference() and structured() constructors', () => {
    expect(TaskType.inference().value).toBe('inference')
    expect(TaskType.structured().value).toBe('structured')
  })

  it('compares by value with equals', () => {
    expect(TaskType.inference().equals(TaskType.inference())).toBe(true)
    expect(TaskType.inference().equals(TaskType.structured())).toBe(false)
  })
})
