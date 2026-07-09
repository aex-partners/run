import { EntityRegistry } from '@/contexts/costing/application/ports/out/EntityRegistry'
import { Cond, RecordRow, RecordStore } from '@/contexts/costing/application/ports/out/RecordStore'

export class InMemoryRecordStore implements RecordStore, EntityRegistry {
  private seq = 0
  private readonly slugs = new Map<string, string>()      // slug -> entityId
  private readonly rows = new Map<string, RecordRow & { entityId: string }>()

  seedEntity(slug: string, id: string) { this.slugs.set(slug, id) }
  seedRecord(entityId: string, row: RecordRow) { this.rows.set(row.id, { ...row, entityId }) }

  async entityIdBySlug(slug: string) { return this.slugs.get(slug) ?? null }

  async query(entityId: string, where: Cond[]): Promise<RecordRow[]> {
    return [...this.rows.values()]
      .filter((r) => r.entityId === entityId)
      .filter((r) => where.every((c) => this.match(r, c)))
      .map(({ entityId: _e, ...row }) => row)
  }
  private match(r: RecordRow & { entityId: string }, c: Cond): boolean {
    const v = c.field === 'id' ? r.id : r.data[c.field]
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
