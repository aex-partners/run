import { describe, it, expect } from 'vitest'
import {
  Label,
  DEFAULT_LABEL_COLOR,
  isSnoozeLabel,
  makeSnoozeLabel,
  snoozeWakeIso,
  withSnooze,
  withoutSnooze,
  toggleLabel,
  parseLabels,
  resolveSnoozeWake,
} from '@/contexts/email/domain/Label'

const NOW = new Date('2024-03-10T12:00:00.000Z')

describe('snooze marker encoding', () => {
  it('makeSnoozeLabel embeds the ISO wake instant behind the __snoozed: prefix', () => {
    const label = makeSnoozeLabel(NOW)
    expect(isSnoozeLabel(label)).toBe(true)
    expect(label.color).toBe(DEFAULT_LABEL_COLOR)
    expect(snoozeWakeIso(label)).toBe(NOW.toISOString())
  })

  it('snoozeWakeIso returns null for a normal label', () => {
    expect(snoozeWakeIso({ name: 'Work', color: '#fff' })).toBeNull()
  })

  it('isSnoozeLabel distinguishes markers from real labels', () => {
    expect(isSnoozeLabel({ name: 'Work', color: '#fff' })).toBe(false)
  })
})

describe('withSnooze / withoutSnooze', () => {
  const real: Label[] = [
    { name: 'Work', color: '#111' },
    { name: 'Urgent', color: '#222' },
  ]

  it('withoutSnooze keeps real labels in order and drops markers', () => {
    const labels = [...real, makeSnoozeLabel(NOW)]
    expect(withoutSnooze(labels)).toEqual(real)
  })

  it('withSnooze replaces any prior marker (never two at once)', () => {
    const later = new Date(NOW.getTime() + 3600_000)
    const labels = withSnooze([...real, makeSnoozeLabel(NOW)], later)
    const markers = labels.filter(isSnoozeLabel)
    expect(markers).toHaveLength(1)
    expect(snoozeWakeIso(markers[0]!)).toBe(later.toISOString())
    expect(withoutSnooze(labels)).toEqual(real)
  })
})

describe('toggleLabel', () => {
  it('adds a missing label with the supplied colour', () => {
    expect(toggleLabel([], 'Work', '#abc')).toEqual([{ name: 'Work', color: '#abc' }])
  })

  it('removes an existing label keeping the rest in order', () => {
    const labels: Label[] = [
      { name: 'A', color: '#1' },
      { name: 'B', color: '#2' },
      { name: 'C', color: '#3' },
    ]
    expect(toggleLabel(labels, 'B', '#x')).toEqual([
      { name: 'A', color: '#1' },
      { name: 'C', color: '#3' },
    ])
  })
})

describe('parseLabels', () => {
  it('parses a well-formed JSON array', () => {
    expect(parseLabels('[{"name":"Work","color":"#abc"}]')).toEqual([{ name: 'Work', color: '#abc' }])
  })

  it('defaults missing colours', () => {
    expect(parseLabels('[{"name":"Work"}]')).toEqual([{ name: 'Work', color: DEFAULT_LABEL_COLOR }])
  })

  it('drops entries without a string name', () => {
    expect(parseLabels('[{"color":"#abc"},{"name":42}]')).toEqual([])
  })

  it('returns [] on malformed / non-array JSON', () => {
    expect(parseLabels('not json')).toEqual([])
    expect(parseLabels('{"name":"x"}')).toEqual([])
  })
})

describe('resolveSnoozeWake', () => {
  it('1h adds one hour', () => {
    const r = resolveSnoozeWake('1h', NOW)
    expect(r.ok && r.value.getTime()).toBe(NOW.getTime() + 60 * 60 * 1000)
  })

  it('3h adds three hours', () => {
    const r = resolveSnoozeWake('3h', NOW)
    expect(r.ok && r.value.getTime()).toBe(NOW.getTime() + 3 * 60 * 60 * 1000)
  })

  it('tomorrow lands on the next day at 08:00 local', () => {
    const r = resolveSnoozeWake('tomorrow', NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.getDate()).toBe(NOW.getDate() + 1)
    expect(r.value.getHours()).toBe(8)
    expect(r.value.getMinutes()).toBe(0)
  })

  it('nextWeek is at least a day ahead at 08:00 local', () => {
    const r = resolveSnoozeWake('nextWeek', NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.getHours()).toBe(8)
    expect(r.value.getTime()).toBeGreaterThan(NOW.getTime())
  })

  it('fails for an unknown option', () => {
    expect(resolveSnoozeWake('whenever', NOW).ok).toBe(false)
  })
})
