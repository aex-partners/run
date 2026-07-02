import { Result, ok, fail } from '@/shared/kernel/Result'
import { JsonObject, Json } from '@/shared/domain/Json'
import { RecordSink } from '@/contexts/bling/application/ports/out/RecordSink'
import { BlingSyncMapPort } from '@/contexts/bling/application/ports/out/BlingSyncMapPort'
import { InsertRecord } from '@/contexts/data/application/ports/in/InsertRecord'
import { UpdateRecord } from '@/contexts/data/application/ports/in/UpdateRecord'
import { GetRecord } from '@/contexts/data/application/ports/in/GetRecord'
import { Clock } from '@/shared/kernel/Clock'

export interface DataRecordSinkDeps {
  insert: InsertRecord
  update: UpdateRecord
  get: GetRecord
  syncMap: BlingSyncMapPort
  clock: Clock
}

// Deterministically stringify a JSON value with object keys sorted, so the
// same logical data always hashes the same regardless of key order (the Bling
// API does not guarantee stable key order across requests).
const stableStringify = (value: Json): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

// ACL bridge: bling RecordSink -> data InsertRecord/UpdateRecord/GetRecord.
// Upserts a mirrored record keyed by its Bling external id via the
// bling_sync_map (BlingSyncMapPort): unseen externalId inserts, an unchanged
// content hash skips the write entirely, a changed hash updates against the
// record's current version (re-read via GetRecord so a concurrent edit's
// version isn't clobbered). Never throws across the port -- any underlying
// `!ok` from the data in-ports is surfaced as a `fail`.
export class DataRecordSink implements RecordSink {
  private readonly insert: InsertRecord
  private readonly update: UpdateRecord
  private readonly get: GetRecord
  private readonly syncMap: BlingSyncMapPort
  private readonly clock: Clock

  constructor(deps: DataRecordSinkDeps) {
    this.insert = deps.insert
    this.update = deps.update
    this.get = deps.get
    this.syncMap = deps.syncMap
    this.clock = deps.clock
  }

  async upsertExternal(input: {
    entityId: string
    slug: string
    externalId: string
    data: JsonObject
  }): Promise<Result<{ recordId: string; changed: boolean; inserted: boolean }>> {
    const { entityId, slug, externalId, data } = input
    const hash = stableStringify(data)
    const existing = await this.syncMap.get(slug, externalId)

    if (!existing) {
      const inserted = await this.insert.execute({ entityId, data })
      if (!inserted.ok) return fail(inserted.error)
      await this.syncMap.put({
        entitySlug: slug,
        externalId,
        recordId: inserted.value.id,
        version: inserted.value.version,
        contentHash: hash,
      })
      return ok({ recordId: inserted.value.id, inserted: true, changed: true })
    }

    if (existing.contentHash === hash) {
      return ok({ recordId: existing.recordId, inserted: false, changed: false })
    }

    const cur = await this.get.execute({ recordId: existing.recordId })
    const expectedVersion = cur?.version ?? existing.version
    const updated = await this.update.execute({ recordId: existing.recordId, data, expectedVersion })
    if (!updated.ok) return fail(updated.error)
    await this.syncMap.put({
      entitySlug: slug,
      externalId,
      recordId: existing.recordId,
      version: updated.value.version,
      contentHash: hash,
    })
    return ok({ recordId: existing.recordId, inserted: false, changed: true })
  }
}
