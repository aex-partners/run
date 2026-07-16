import { EntityRegistry } from '@/contexts/precificacao/application/ports/out/EntityRegistry'
import { Cond, RecordRow, RecordStore } from '@/contexts/precificacao/application/ports/out/RecordStore'

export class InMemoryRecordStore implements RecordStore, EntityRegistry {
  private seq = 0
  private readonly slugs = new Map<string, string>()      // slug -> entityId
  private readonly rows = new Map<string, RecordRow & { entityId: string }>()

  seedEntity(slug: string, id: string) { this.slugs.set(slug, id) }
  seedRecord(entityId: string, row: RecordRow) { this.rows.set(row.id, { ...row, entityId }) }

  async entityIdBySlug(slug: string) { return this.slugs.get(slug) ?? null }

  // MIRRORS the real query engine (data/adapters/out/persistence/DrizzleQueryRecords):
  // `ORDER BY created_at DESC` + `LIMIT Math.min(limit ?? 50, 500)`. Insertion order
  // approximates created_at here, so rows come back NEWEST-FIRST and the cap keeps the newest N.
  //
  // Two behaviours are mirrored, and BOTH matter:
  //   * WHICH rows survive the cap — when it bites, the OLDEST vanish silently. A fake without
  //     the cap makes every truncation bug invisible to the whole suite.
  //   * The ORDER they come back in — NEWEST-FIRST. A fake returning insertion order lets a
  //     caller that depends on row position pass in tests and behave the OPPOSITE way in prod.
  // Do not remove either half.
  async query(entityId: string, where: Cond[], limit?: number): Promise<RecordRow[]> {
    const matched = [...this.rows.values()]
      .filter((r) => r.entityId === entityId)
      .filter((r) => where.every((c) => this.match(r, c)))
      .reverse()                                          // created_at DESC: newest first
    const cap = Math.min(limit ?? 50, 500)
    const kept = cap > 0 ? matched.slice(0, cap) : []
    return kept.map(({ entityId: _e, ...row }) => row)
  }
  private match(r: RecordRow & { entityId: string }, c: Cond): boolean {
    if (c.field === 'id') throw new Error('InMemoryRecordStore: query by field "id" is unsupported (the real query engine has no record-id data field); use get(recordId)')
    const v = r.data[c.field]
    if (c.op === 'eq') return v === c.value
    return (c.values ?? []).includes(v)
  }
  async get(recordId: string) {
    const r = this.rows.get(recordId)
    return r ? { id: r.id, version: r.version, data: r.data } : null
  }
  async insert(entityId: string, data: Record<string, unknown>) {
    const id = `r${++this.seq}`
    this.rows.set(id, { id, version: 1, data, entityId })
    return id
  }
  async update(recordId: string, data: Record<string, unknown>, expectedVersion: number) {
    const r = this.rows.get(recordId)
    if (!r) throw new Error('not found')
    if (r.version !== expectedVersion) throw new Error('version conflict')
    this.rows.set(recordId, { ...r, data, version: r.version + 1 })
  }
  async delete(recordId: string) {
    this.rows.delete(recordId)
  }
}
