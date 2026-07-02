import { Json } from '@/shared/domain/Json'

// A relation value a mapper emits BEFORE the target's AEX record id is known.
// The orchestrator resolves it against the FkCache at upsert time (→ recordId or
// null). Keeps mappers pure and I/O-free.
export interface RelRef {
  __rel: true
  slug: string
  externalId: string
}

export type MappedValue = Json | RelRef

export interface MappedRecord {
  slug: string
  externalId: string
  data: Record<string, MappedValue>
}

export function relRef(slug: string, externalId: string | number | null | undefined): RelRef | null {
  if (externalId === null || externalId === undefined) return null
  const ext = String(externalId)
  if (ext === '' || ext === '0') return null
  return { __rel: true, slug, externalId: ext }
}

export function isRelRef(v: unknown): v is RelRef {
  return typeof v === 'object' && v !== null && (v as { __rel?: unknown }).__rel === true
}
