import { describe, it, expect } from 'vitest'
import { ListPieceToolsService } from '@/contexts/plugins/application/queries/ListPieceToolsService'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { PieceRegistry, PieceCatalogEntry } from '@/contexts/plugins/application/ports/out/PieceRegistry'
import { PieceMetadata, PieceAction } from '@/contexts/plugins/domain/PieceMetadata'
import { Plugin } from '@/contexts/plugins/domain/Plugin'
import { PluginId } from '@/contexts/plugins/domain/ids'

const NOW = new Date('2024-01-01T00:00:00.000Z')

function plugin(id: string, name: string, pieceName: string | null, icon: string | null = null): Plugin {
  return Plugin.rehydrate({
    id: PluginId.of(id),
    name,
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

function meta(pieceName: string, actions: PieceAction[]): PieceMetadata {
  return { pieceName, displayName: pieceName, hasAuth: false, actions, triggers: [] }
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

describe('ListPieceToolsService', () => {
  it('returns an empty list when nothing is installed', async () => {
    const svc = new ListPieceToolsService(new FakeRepo([]), fakeRegistry(new Map()))
    expect(await svc.execute()).toEqual([])
  })

  it('lists one view per action with the unsanitized name and display fallbacks', async () => {
    const repo = new FakeRepo([plugin('p1', 'Gmail', 'piece-gmail', '/icons/gmail.svg')])
    const registry = fakeRegistry(
      new Map([
        [
          'piece-gmail',
          meta('piece-gmail', [
            { name: 'send_email', displayName: 'Send Email', description: 'Sends one email', requireAuth: true, props: [] },
            { name: 'bare', requireAuth: false, props: [] },
          ]),
        ],
      ]),
    )
    const svc = new ListPieceToolsService(repo, registry)
    const tools = await svc.execute()
    expect(tools).toHaveLength(2)
    expect(tools[0]).toEqual({
      name: 'piece-gmail:send_email',
      displayName: 'Send Email',
      description: 'Sends one email',
      pluginName: 'Gmail',
      pluginDisplayName: 'Gmail',
      pluginLogoUrl: '/icons/gmail.svg',
    })
    // Missing displayName/description fall back to action name / empty string.
    expect(tools[1].displayName).toBe('bare')
    expect(tools[1].description).toBe('')
  })

  it('skips plugins without a piece name and those that fail to load', async () => {
    const repo = new FakeRepo([
      plugin('p1', 'Gmail', 'piece-gmail'),
      plugin('p2', 'Manual', null),
      plugin('p3', 'Broken', 'piece-broken'),
    ])
    const registry = fakeRegistry(new Map([['piece-gmail', meta('piece-gmail', [{ name: 'a', requireAuth: false, props: [] }])]]))
    const svc = new ListPieceToolsService(repo, registry)
    const tools = await svc.execute()
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('piece-gmail:a')
  })
})
