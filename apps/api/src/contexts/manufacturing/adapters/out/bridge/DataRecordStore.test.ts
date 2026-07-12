import { describe, it, expect } from 'vitest'
import { DataRecordStore } from '@/contexts/manufacturing/adapters/out/bridge/DataRecordStore'

describe('DataRecordStore.insert', () => {
  it('forwards the resolved owner id as createdBy', async () => {
    const insertCalls: { entityId: string; data: unknown; createdBy?: string }[] = []
    const insert = {
      execute: async (cmd: { entityId: string; data: unknown; createdBy?: string }) => {
        insertCalls.push(cmd)
        return { ok: true, value: { id: 'r1' } }
      },
    }
    const resolveOwner = { ownerId: async () => 'OWNER1' }
    const store = new DataRecordStore({
      listEntities: { execute: async () => [] },
      query: { execute: async () => ({ entity: '', rows: [] }) },
      get: { execute: async () => null },
      insert,
      update: { execute: async () => ({ ok: true }) },
      delete: { execute: async () => ({ ok: true }) },
      resolveOwner,
    })

    const id = await store.insert('e1', { foo: 'bar' })

    expect(id).toBe('r1')
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0].createdBy).toBe('OWNER1')
  })

  it('throws when no owner can be resolved', async () => {
    const insert = { execute: async () => ({ ok: true, value: { id: 'r1' } }) }
    const resolveOwner = { ownerId: async () => null }
    const store = new DataRecordStore({
      listEntities: { execute: async () => [] },
      query: { execute: async () => ({ entity: '', rows: [] }) },
      get: { execute: async () => null },
      insert,
      update: { execute: async () => ({ ok: true }) },
      delete: { execute: async () => ({ ok: true }) },
      resolveOwner,
    })

    await expect(store.insert('e1', { foo: 'bar' })).rejects.toThrow(
      'nenhum usuário owner: não é possível gravar registros',
    )
  })
})
