import { describe, it, expect } from 'vitest'
import { SetPluginEnabledService } from '@/contexts/plugins/application/use-cases/SetPluginEnabledService'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { Plugin } from '@/contexts/plugins/domain/Plugin'
import { PluginStatus } from '@/contexts/plugins/domain/PluginStatus'
import { PluginId } from '@/contexts/plugins/domain/ids'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

function plugin(status: PluginStatus): Plugin {
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
    status,
    config: {},
    installedAt: status === 'available' ? null : NOW,
    installedBy: status === 'available' ? null : 'u',
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

describe('SetPluginEnabledService', () => {
  it('fails when the plugin does not exist', async () => {
    const svc = new SetPluginEnabledService(new FakeRepo(new Map()), new FakeEvents(), clock)
    const r = await svc.execute({ id: 'missing', enabled: false })
    expect(r.ok).toBe(false)
  })

  it('disables an installed plugin, saves and publishes PluginDisabled', async () => {
    const p = plugin('installed')
    const repo = new FakeRepo(new Map([['p1', p]]))
    const events = new FakeEvents()
    const svc = new SetPluginEnabledService(repo, events, clock)
    const r = await svc.execute({ id: 'p1', enabled: false })
    expect(r.ok).toBe(true)
    expect(p.status).toBe('disabled')
    expect(repo.saved).toHaveLength(1)
    expect(events.published.some((e) => e.name === 'plugins.PluginDisabled')).toBe(true)
  })

  it('enables a disabled plugin, publishing PluginEnabled', async () => {
    const p = plugin('disabled')
    const repo = new FakeRepo(new Map([['p1', p]]))
    const events = new FakeEvents()
    const svc = new SetPluginEnabledService(repo, events, clock)
    const r = await svc.execute({ id: 'p1', enabled: true })
    expect(r.ok).toBe(true)
    expect(p.status).toBe('installed')
    expect(events.published.some((e) => e.name === 'plugins.PluginEnabled')).toBe(true)
  })

  it('fails when toggling a plugin that is not installed (still available)', async () => {
    const p = plugin('available')
    const repo = new FakeRepo(new Map([['p1', p]]))
    const events = new FakeEvents()
    const svc = new SetPluginEnabledService(repo, events, clock)
    const r = await svc.execute({ id: 'p1', enabled: true })
    expect(r.ok).toBe(false)
    expect(repo.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })
})
