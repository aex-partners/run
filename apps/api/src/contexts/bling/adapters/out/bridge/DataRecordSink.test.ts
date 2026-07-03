import { describe, it, expect } from 'vitest'
import { DataRecordSink } from '@/contexts/bling/adapters/out/bridge/DataRecordSink'
import { ok } from '@/shared/kernel/Result'

describe('DataRecordSink', () => {
  it('inserts when unseen, skips when hash unchanged, updates when changed', async () => {
    const map = new Map<string, { recordId: string; version: number; contentHash: string }>()
    const syncMap = {
      listAll: async () => [], get: async (s: string, e: string) => map.get(`${s}:${e}`) ?? null,
      put: async (r: never) => { const x = r as { entitySlug: string; externalId: string; recordId: string; version: number; contentHash: string }; map.set(`${x.entitySlug}:${x.externalId}`, { recordId: x.recordId, version: x.version, contentHash: x.contentHash }) },
    }
    let inserts = 0, updates = 0
    const insertCalls: { entityId: string; data: unknown; createdBy?: string }[] = []
    const insert = { execute: async (cmd: { entityId: string; data: unknown; createdBy?: string }) => { inserts++; insertCalls.push(cmd); return ok({ id: 'r1', version: 0 }) } }
    const update = { execute: async () => { updates++; return ok({ version: 1 }) } }
    const get = { execute: async () => ({ id: 'r1', data: {}, version: 0 }) }
    const sink = new DataRecordSink({ insert, update, get, syncMap } as never)

    const a = await sink.upsertExternal({ entityId: 'e1', slug: 'bling_depositos', externalId: '1', data: { descricao: 'x' }, createdBy: 'owner-1' })
    expect(a.ok && a.value.inserted).toBe(true); expect(inserts).toBe(1)
    const b = await sink.upsertExternal({ entityId: 'e1', slug: 'bling_depositos', externalId: '1', data: { descricao: 'x' }, createdBy: 'owner-1' })
    expect(b.ok && b.value.changed).toBe(false); expect(updates).toBe(0) // unchanged → skip
    const c = await sink.upsertExternal({ entityId: 'e1', slug: 'bling_depositos', externalId: '1', data: { descricao: 'y' }, createdBy: 'owner-1' })
    expect(c.ok && c.value.changed).toBe(true); expect(updates).toBe(1) // changed → update

    // Fix 1 regression: createdBy must be forwarded to InsertRecord so
    // entity_records.created_by is never persisted empty.
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0].createdBy).toBe('owner-1')
  })
})
