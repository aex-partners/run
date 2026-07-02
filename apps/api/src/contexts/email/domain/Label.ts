import { Result, ok, fail } from '@/shared/kernel/Result'

// VO. A tag attached to an email, stored inline in the `emails.labels` JSON
// column. The default colour matches the AEX router (#6b7280).
export interface Label {
  readonly name: string
  readonly color: string
}

export const DEFAULT_LABEL_COLOR = '#6b7280'

// Snooze is modelled as a special, internal label `__snoozed:<ISO>` rather than
// a separate column — ported 1:1 from AEX. These helpers are the single place
// that knows the encoding, so the prefix never leaks into the rest of the domain.
const SNOOZE_PREFIX = '__snoozed:'

export const isSnoozeLabel = (label: Label): boolean => label.name.startsWith(SNOOZE_PREFIX)

export const makeSnoozeLabel = (until: Date): Label => ({
  name: `${SNOOZE_PREFIX}${until.toISOString()}`,
  color: DEFAULT_LABEL_COLOR,
})

// The wake instant encoded in a snooze label, or null if it cannot be parsed.
export const snoozeWakeIso = (label: Label): string | null =>
  isSnoozeLabel(label) ? label.name.slice(SNOOZE_PREFIX.length) : null

// Drops any snooze marker, preserving the user's real labels in order.
export const withoutSnooze = (labels: readonly Label[]): Label[] =>
  labels.filter((l) => !isSnoozeLabel(l))

// Adds the snooze marker, replacing any previous one so an email is never
// snoozed to two different instants at once.
export const withSnooze = (labels: readonly Label[], until: Date): Label[] => [
  ...withoutSnooze(labels),
  makeSnoozeLabel(until),
]

// Toggles a named label on/off. Adding uses the supplied colour; removing keeps
// the remaining labels in their original order.
export const toggleLabel = (labels: readonly Label[], name: string, color: string): Label[] => {
  const idx = labels.findIndex((l) => l.name === name)
  if (idx >= 0) return labels.filter((_, i) => i !== idx)
  return [...labels, { name, color }]
}

// Parses the persisted JSON column into a Label[]; tolerates malformed values by
// returning an empty list (matches AEX's safeParseJson).
export const parseLabels = (raw: string): Label[] => {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((l): l is { name: unknown; color?: unknown } => typeof l === 'object' && l !== null)
      .filter((l) => typeof l.name === 'string')
      .map((l) => ({ name: l.name as string, color: typeof l.color === 'string' ? l.color : DEFAULT_LABEL_COLOR }))
  } catch {
    return []
  }
}

// A snooze option from the UI resolved to a concrete wake instant. Pure: given
// the same `now`, the same option always yields the same Date. Ported 1:1 from
// the AEX snooze switch (8am local for tomorrow/next week).
export type SnoozeOption = '1h' | '3h' | 'tomorrow' | 'nextWeek'

export const resolveSnoozeWake = (option: string, now: Date): Result<Date> => {
  switch (option) {
    case '1h':
      return ok(new Date(now.getTime() + 60 * 60 * 1000))
    case '3h':
      return ok(new Date(now.getTime() + 3 * 60 * 60 * 1000))
    case 'tomorrow': {
      const d = new Date(now)
      d.setDate(d.getDate() + 1)
      d.setHours(8, 0, 0, 0)
      return ok(d)
    }
    case 'nextWeek': {
      const d = new Date(now)
      d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
      d.setHours(8, 0, 0, 0)
      return ok(d)
    }
    default:
      return fail('Email: invalid snooze option')
  }
}
