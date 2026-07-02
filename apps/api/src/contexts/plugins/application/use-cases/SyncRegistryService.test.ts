import { describe, it, expect } from 'vitest'
import { SyncRegistryService } from '@/contexts/plugins/application/use-cases/SyncRegistryService'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { PieceRegistry, PieceCatalogEntry } from '@/contexts/plugins/application/ports/out/PieceRegistry'
import { PieceMetadata } from '@/contexts/plugins/domain/PieceMetadata'
import { Plugin } from '@/contexts/plugins/domain/Plugin'
import { PluginId } from '@/contexts/plugins/domain/ids'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

function entry(over: Partial<PieceCatalogEntry> = {}): PieceCatalogEntry {
  return {
    id: 'cat-1',
    name: 'Gmail',
    description: 'Email piece',
    version: '2.0.0',
    category: 'communication',
    pieceName: 'piece-gmail',
    authType: 'oauth2',
    authProps: [],
    icon: null,
    source: 'piece',
    manifest: null,
    raw: {},
    ...over,
  }
}

class FakeRepo implements PluginRepository {
  saved: Plugin[] = []
  constructor(private readonly map: Map<string, Plugin> = new Map()) {}
  nextId(): PluginId {
    return PluginId.of('new')
  }
  async findById(id: PluginId): Promise<Plugin | null> {
    return this.map.get(id.value) ?? null
  }
  async findInstalled(): Promise<Plugin[]> {
    return []
  }
  async save(p: Plugin): Promise<void> {
    this.saved.push(p)
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

describe('SyncRegistryService', () => {
  it('returns synced 0 and saves nothing for an empty catalog', async () => {
    const repo = new FakeRepo()
    const svc = new SyncRegistryService(repo, fakeRegistry([]), clock)
    const r = await svc.execute()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.synced).toBe(0)
    expect(repo.saved).toHaveLength(0)
  })

  it('creates a brand-new available plugin row for an unknown catalog entry', async () => {
    const repo = new FakeRepo()
    const svc = new SyncRegistryService(repo, fakeRegistry([entry()]), clock)
    const r = await svc.execute()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.synced).toBe(1)
    expect(repo.saved).toHaveLength(1)
    expect(repo.saved[0].status).toBe('available')
    expect(repo.saved[0].name).toBe('Gmail')
    expect(repo.saved[0].pieceName).toBe('piece-gmail')
  })

  it('refreshes metadata of an existing row while PRESERVING status and config', async () => {
    const existing = Plugin.rehydrate({
      id: PluginId.of('cat-1'),
      name: 'Old Name',
      description: null,
      version: '1.0.0',
      author: null,
      icon: null,
      category: null,
      manifest: null,
      pieceName: 'piece-gmail',
      authType: null,
      source: 'piece',
      sourceUrl: null,
      status: 'installed',
      config: { apiKey: 'keep-me' },
      installedAt: NOW,
      installedBy: 'u',
      updatedAt: NOW,
    })
    const repo = new FakeRepo(new Map([['cat-1', existing]]))
    const svc = new SyncRegistryService(repo, fakeRegistry([entry({ name: 'Gmail v2' })]), clock)
    const r = await svc.execute()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.synced).toBe(1)
    // Metadata refreshed...
    expect(existing.name).toBe('Gmail v2')
    expect(existing.version).toBe('2.0.0')
    // ...but install state and config are untouched.
    expect(existing.status).toBe('installed')
    expect(existing.config).toEqual({ apiKey: 'keep-me' })
  })
})
