// In-memory external-id → AEX record-id map, keyed by entity slug. Hydrated from
// the bling_sync_map at the start of a sync, updated on every upsert. Ported from
// the old fk-cache.ts (persistence-backed hydration, not per-entity queries).
export class FkCache {
  private readonly buckets = new Map<string, Map<string, string>>()

  private bucket(slug: string): Map<string, string> {
    let b = this.buckets.get(slug)
    if (!b) { b = new Map(); this.buckets.set(slug, b) }
    return b
  }

  set(slug: string, externalId: string, recordId: string): void {
    this.bucket(slug).set(String(externalId), recordId)
  }

  lookup(slug: string, externalId: string | null | undefined): string | null {
    if (externalId == null) return null
    const ext = String(externalId)
    if (ext === '0') return null
    return this.buckets.get(slug)?.get(ext) ?? null
  }

  hydrateFrom(rows: { entitySlug: string; externalId: string; recordId: string }[]): void {
    for (const r of rows) this.set(r.entitySlug, r.externalId, r.recordId)
  }
}
