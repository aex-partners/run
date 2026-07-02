import { describe, it, expect } from 'vitest'
import { UninstallPluginService } from '@/contexts/plugins/application/use-cases/UninstallPluginService'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { PieceInstaller } from '@/contexts/plugins/application/ports/out/PieceInstaller'
import { Plugin } from '@/contexts/plugins/domain/Plugin'
import { PluginId } from '@/contexts/plugins/domain/ids'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

function installedPlugin(pieceName: string | null = 'piece-gmail'): Plugin {
  return Plugin.rehydrate({
    id: PluginId.of('p1'),
    name: 'Gmail',
    description: null,
    version: '1.0.0',
    author: null,
    icon: null,
    category: null,
    manifest: null,
    pieceName,
    authType: null,
    source: 'piece',
    sourceUrl: null,
    status: 'installed',
    config: { apiKey: 'x' },
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

describe('UninstallPluginService', () => {
  const noopInstaller: PieceInstaller = { install: async () => {}, uninstall: async () => {} }

  it('is a silent no-op when the plugin does not exist', async () => {
    const repo = new FakeRepo(new Map())
    const events = new FakeEvents()
    const svc = new UninstallPluginService(repo, noopInstaller, events, clock)
    const r = await svc.execute({ id: 'missing' })
    expect(r.ok).toBe(true)
    expect(repo.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })

  it('uninstalls the package, resets to available, saves and publishes PluginUninstalled', async () => {
    const p = installedPlugin()
    const repo = new FakeRepo(new Map([['p1', p]]))
    const events = new FakeEvents()
    let removed = ''
    const installer: PieceInstaller = {
      install: async () => {},
      uninstall: async (name: string) => {
        removed = name
      },
    }
    const svc = new UninstallPluginService(repo, installer, events, clock)
    const r = await svc.execute({ id: 'p1' })
    expect(r.ok).toBe(true)
    expect(removed).toBe('piece-gmail')
    expect(p.status).toBe('available')
    expect(p.config).toEqual({})
    expect(repo.saved).toHaveLength(1)
    expect(events.published.some((e) => e.name === 'plugins.PluginUninstalled')).toBe(true)
  })

  it('still resets the aggregate when the package uninstall throws (best-effort)', async () => {
    const p = installedPlugin()
    const repo = new FakeRepo(new Map([['p1', p]]))
    const events = new FakeEvents()
    const installer: PieceInstaller = {
      install: async () => {},
      uninstall: async () => {
        throw new Error('npm boom')
      },
    }
    const svc = new UninstallPluginService(repo, installer, events, clock)
    const r = await svc.execute({ id: 'p1' })
    expect(r.ok).toBe(true)
    expect(p.status).toBe('available')
    expect(repo.saved).toHaveLength(1)
  })

  it('skips the installer when the plugin carries no piece package', async () => {
    const p = installedPlugin(null)
    const repo = new FakeRepo(new Map([['p1', p]]))
    const events = new FakeEvents()
    let called = false
    const installer: PieceInstaller = {
      install: async () => {},
      uninstall: async () => {
        called = true
      },
    }
    const svc = new UninstallPluginService(repo, installer, events, clock)
    const r = await svc.execute({ id: 'p1' })
    expect(r.ok).toBe(true)
    expect(called).toBe(false)
    expect(p.status).toBe('available')
  })
})
