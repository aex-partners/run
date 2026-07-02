import { describe, it, expect } from 'vitest'
import { InstallPluginService } from '@/contexts/plugins/application/use-cases/InstallPluginService'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { PieceInstaller } from '@/contexts/plugins/application/ports/out/PieceInstaller'
import { Plugin } from '@/contexts/plugins/domain/Plugin'
import { PluginId } from '@/contexts/plugins/domain/ids'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

function availablePlugin(pieceName: string | null = 'piece-gmail'): Plugin {
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
    status: 'available',
    config: {},
    installedAt: null,
    installedBy: null,
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
  async save(plugin: Plugin): Promise<void> {
    this.saved.push(plugin)
  }
}

class FakeEvents {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

describe('InstallPluginService', () => {
  const noopInstaller: PieceInstaller = { install: async () => {}, uninstall: async () => {} }

  it('fails when the plugin does not exist', async () => {
    const svc = new InstallPluginService(new FakeRepo(new Map()), noopInstaller, new FakeEvents(), clock)
    const r = await svc.execute({ id: 'missing', userId: 'u' })
    expect(r.ok).toBe(false)
  })

  it('persists the installing transition, publishes, and kicks off the installer', async () => {
    const plugin = availablePlugin()
    const repo = new FakeRepo(new Map([['p1', plugin]]))
    const events = new FakeEvents()
    let installedPiece = ''
    // A deferred promise keeps the package install pending so the `installing`
    // state is observable before completion runs.
    let release!: () => void
    const gate = new Promise<void>((res) => {
      release = res
    })
    const installer: PieceInstaller = {
      install: async (name: string) => {
        installedPiece = name
        await gate
      },
      uninstall: async () => {},
    }
    const svc = new InstallPluginService(repo, installer, events, clock)
    const r = await svc.execute({ id: 'p1', userId: 'u' })
    expect(r.ok).toBe(true)
    expect(plugin.status).toBe('installing')
    expect(installedPiece).toBe('piece-gmail')
    expect(repo.saved.length).toBeGreaterThanOrEqual(1)
    expect(events.published.some((e) => e.name === 'plugins.PluginInstalling')).toBe(true)

    // Release the install and let the fire-and-forget completion settle.
    release()
    await new Promise((res) => setTimeout(res, 0))
    expect(plugin.status).toBe('installed')
    expect(events.published.some((e) => e.name === 'plugins.PluginInstalled')).toBe(true)
  })

  it('records error when the package install rejects', async () => {
    const plugin = availablePlugin()
    const repo = new FakeRepo(new Map([['p1', plugin]]))
    const events = new FakeEvents()
    const installer: PieceInstaller = {
      install: async () => {
        throw new Error('npm boom')
      },
      uninstall: async () => {},
    }
    const svc = new InstallPluginService(repo, installer, events, clock)
    const r = await svc.execute({ id: 'p1', userId: 'u' })
    expect(r.ok).toBe(true)
    await new Promise((res) => setTimeout(res, 0))
    expect(plugin.status).toBe('error')
    expect(events.published.some((e) => e.name === 'plugins.PluginInstallFailed')).toBe(true)
  })

  it('is a no-op when the plugin is already installed', async () => {
    const plugin = availablePlugin()
    plugin.beginInstall('u', NOW)
    plugin.completeInstall(NOW)
    plugin.pullEvents()
    const repo = new FakeRepo(new Map([['p1', plugin]]))
    const events = new FakeEvents()
    const svc = new InstallPluginService(repo, noopInstaller, events, clock)
    const r = await svc.execute({ id: 'p1', userId: 'u' })
    expect(r.ok).toBe(true)
    expect(repo.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })
})
