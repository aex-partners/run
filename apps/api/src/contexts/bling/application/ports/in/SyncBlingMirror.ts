import { Result } from '@/shared/kernel/Result'

// Driving port. Runs the full-mirror sync: pulls every entity in scope from
// Bling and reconciles it into the AEX catalog/records via the out-ports
// (EntityCatalog, RecordSink, BlingSyncMapPort, FkCache). `scope` lets callers
// run the full mirror or just the fast-to-verify categorias slice; `limit`
// caps the number of records pulled per entity (useful for smoke tests).
export interface SyncBlingMirrorCommand {
  scope: 'all' | 'categorias'
  limit?: number
}

// Per-entity outcome counts for a sync run: how many records were inserted,
// updated, left unchanged (skipped), or failed (errors).
export interface SyncSummary {
  entities: { slug: string; inserted: number; updated: number; skipped: number; errors: number }[]
}

export interface SyncBlingMirror {
  execute(cmd: SyncBlingMirrorCommand): Promise<Result<SyncSummary>>
}
