// ACL out-port -> the bling_sync_map persistence table. Tracks the mapping
// from (entitySlug, externalId) to AEX recordId across sync runs, plus enough
// bookkeeping (version, contentHash) to detect unchanged records and skip
// redundant writes. `listAll` feeds FkCache.hydrateFrom at the start of a sync.
export interface BlingSyncMapPort {
  listAll(): Promise<{ entitySlug: string; externalId: string; recordId: string }[]>

  get(slug: string, externalId: string): Promise<{ recordId: string; version: number; contentHash: string } | null>

  put(row: { entitySlug: string; externalId: string; recordId: string; version: number; contentHash: string }): Promise<void>
}
