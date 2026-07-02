import { describe, it, expect } from 'vitest'
import { DiscoverToolsService } from '@/contexts/plugins/application/queries/DiscoverToolsService'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { PieceRegistry, PieceCatalogEntry } from '@/contexts/plugins/application/ports/out/PieceRegistry'
import { PieceMetadata } from '@/contexts/plugins/domain/PieceMetadata'
import { Plugin } from '@/contexts/plugins/domain/Plugin'
import { PluginId } from '@/contexts/plugins/domain/ids'

const NOW = new Date('2024-01-01T00:00:00.000Z')

function plugin(id: string, pieceName: string | null, icon: string | null = null): Plugin {
  return Plugin.rehydrate({
    id: PluginId.of(id),
    name: pieceName ? `Plugin ${id}` : 'Manual',
    description: null,
    version: '1.0.0',
    author: null,
    icon,
    category: null,
    manifest: null,
    pieceName,
    authType: null,
    source: 'piece',
    sourceUrl: null,
    status: 'installed',
    config: {},
    installedAt: NOW,
    installedBy: 'u',
    updatedAt: NOW,
  })
}

function meta(pieceName: string, actionNames: string[]): PieceMetadata {
  return {
    pieceName,
    displayName: pieceName,
    hasAuth: false,
    actions: actionNames.map((name) => ({ name, displayName: name, requireAuth: false, props: [] })),
    triggers: [],
  }
}

class FakeRepo implements PluginRepository {
  constructor(private readonly installed: Plugin[]) {}
  nextId(): PluginId {
    return PluginId.of('new')
  }
  async findById(): Promise<Plugin | null> {
    return null
  }
  async findInstalled(): Promise<Plugin[]> {
    return this.installed
  }
  async save(): Promise<void> {}
}

function fakeRegistry(metas: Map<string, PieceMetadata>): PieceRegistry {
  return {
    async loadMetadata(pieceName: string): Promise<PieceMetadata | null> {
      return metas.get(pieceName) ?? null
    },
    async listCatalog(): Promise<PieceCatalogEntry[]> {
      return []
    },
  }
}

describe('DiscoverToolsService', () => {
  it('returns an empty list when nothing is installed', async () => {
    const svc = new DiscoverToolsService(new FakeRepo([]), fakeRegistry(new Map()))
    expect(await svc.execute()).toEqual([])
  })

  it('skips plugins without a piece name and those whose metadata fails to load', async () => {
    const repo = new FakeRepo([
      plugin('p1', 'piece-gmail'),
      plugin('p2', null), // no piece name -> skipped
      plugin('p3', 'piece-broken'), // metadata returns null -> skipped
    ])
    const registry = fakeRegistry(new Map([['piece-gmail', meta('piece-gmail', ['send_email'])]]))
    const svc = new DiscoverToolsService(repo, registry)
    const tools = await svc.execute()
    expect(tools).toHaveLength(1)
    expect(tools[0].pieceName).toBe('piece-gmail')
    expect(tools[0].actionName).toBe('send_email')
  })

  it('derives one descriptor per action and keeps a usable logo url', async () => {
    const repo = new FakeRepo([plugin('p1', 'piece-gmail', 'https://cdn/gmail.png')])
    const registry = fakeRegistry(
      new Map([['piece-gmail', meta('piece-gmail', ['list_messages', 'send_email'])]]),
    )
    const svc = new DiscoverToolsService(repo, registry)
    const tools = await svc.execute()
    expect(tools).toHaveLength(2)
    expect(tools.map((t) => t.actionName)).toEqual(['list_messages', 'send_email'])
    // list_* classifies read-only; send_* mutating.
    expect(tools[0].readOnly).toBe(true)
    expect(tools[1].readOnly).toBe(false)
    expect(tools[0].pluginLogoUrl).toBe('https://cdn/gmail.png')
  })

  it('drops a non-url icon (data-uri style) to null', async () => {
    const repo = new FakeRepo([plugin('p1', 'piece-gmail', 'data:image/png;base64,xxx')])
    const registry = fakeRegistry(new Map([['piece-gmail', meta('piece-gmail', ['send_email'])]]))
    const svc = new DiscoverToolsService(repo, registry)
    const tools = await svc.execute()
    expect(tools[0].pluginLogoUrl).toBeNull()
  })
})
