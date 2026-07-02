import { describe, it, expect } from 'vitest'
import { ConfigurePluginService } from '@/contexts/plugins/application/use-cases/ConfigurePluginService'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { Plugin } from '@/contexts/plugins/domain/Plugin'
import { PluginId } from '@/contexts/plugins/domain/ids'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

function plugin(): Plugin {
  return Plugin.rehydrate({
    id: PluginId.of('p1'),
    name: 'Gmail',
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
    config: {},
    installedAt: NOW,
    installedBy: 'u',
    updatedAt: NOW,
  })
}

class FakeRepo implements PluginRepository {
  saved: Plugin[] = []
  constructor(private readonly map: Map<string, Plugin>) {}
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

class FakeEvents {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

describe('ConfigurePluginService', () => {
  it('is a silent no-op when the plugin does not exist', async () => {
    const repo = new FakeRepo(new Map())
    const events = new FakeEvents()
    const svc = new ConfigurePluginService(repo, events, clock)
    const r = await svc.execute({ id: 'missing', config: { a: 1 } })
    expect(r.ok).toBe(true)
    expect(repo.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })

  it('replaces the config bag, saves and publishes PluginConfigured', async () => {
    const p = plugin()
    const repo = new FakeRepo(new Map([['p1', p]]))
    const events = new FakeEvents()
    const svc = new ConfigurePluginService(repo, events, clock)
    const r = await svc.execute({ id: 'p1', config: { apiKey: 'secret' } })
    expect(r.ok).toBe(true)
    expect(p.config).toEqual({ apiKey: 'secret' })
    expect(repo.saved).toHaveLength(1)
    expect(events.published.some((e) => e.name === 'plugins.PluginConfigured')).toBe(true)
  })
})
