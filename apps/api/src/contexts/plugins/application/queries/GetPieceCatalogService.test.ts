import { describe, it, expect } from 'vitest'
import { GetPieceCatalogService } from '@/contexts/plugins/application/queries/GetPieceCatalogService'
import { PieceRegistry, PieceCatalogEntry } from '@/contexts/plugins/application/ports/out/PieceRegistry'
import { PieceMetadata } from '@/contexts/plugins/domain/PieceMetadata'

function entry(id: string, raw: PieceCatalogEntry['raw']): PieceCatalogEntry {
  return {
    id,
    name: id,
    description: null,
    version: '1.0.0',
    category: null,
    pieceName: `piece-${id}`,
    authType: null,
    authProps: [],
    icon: null,
    source: 'piece',
    manifest: null,
    raw,
  }
}

function fakeRegistry(entries: PieceCatalogEntry[]): PieceRegistry {
  return {
    async loadMetadata(): Promise<PieceMetadata | null> {
      return null
    },
    async listCatalog(): Promise<PieceCatalogEntry[]> {
      return entries
    },
  }
}

describe('GetPieceCatalogService', () => {
  it('returns an empty list for an empty catalog', async () => {
    const svc = new GetPieceCatalogService(fakeRegistry([]))
    expect(await svc.execute()).toEqual([])
  })

  it("surfaces each entry's raw JSON verbatim", async () => {
    const a = { kind: 'a', nested: { x: 1 } }
    const b = { kind: 'b' }
    const svc = new GetPieceCatalogService(fakeRegistry([entry('a', a), entry('b', b)]))
    const out = await svc.execute()
    expect(out).toEqual([a, b])
  })
})
