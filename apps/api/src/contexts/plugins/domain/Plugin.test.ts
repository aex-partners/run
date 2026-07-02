import { describe, it, expect } from 'vitest'
import { Plugin, RehydratePluginProps } from '@/contexts/plugins/domain/Plugin'
import { PluginId } from '@/contexts/plugins/domain/ids'
import { PluginStatus } from '@/contexts/plugins/domain/PluginStatus'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const LATER = new Date('2024-01-02T00:00:00.000Z')

function makePlugin(status: PluginStatus, pieceName: string | null = 'piece-gmail'): Plugin {
  const props: RehydratePluginProps = {
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
    status,
    config: {},
    installedAt: null,
    installedBy: null,
    updatedAt: NOW,
  }
  return Plugin.rehydrate(props)
}

describe('Plugin.beginInstall', () => {
  it('transitions available -> installing and records an event', () => {
    const p = makePlugin('available')
    const r = p.beginInstall('user-1', LATER)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.started).toBe(true)
    expect(p.status).toBe('installing')
    expect(p.installedBy).toBe('user-1')
    expect(p.updatedAt).toBe(LATER)
    const events = p.pullEvents()
    expect(events.map((e) => e.name)).toContain('plugins.PluginInstalling')
  })

  it('allows re-install from error and disabled', () => {
    expect(makePlugin('error').beginInstall('u', LATER).ok).toBe(true)
    expect(makePlugin('disabled').beginInstall('u', LATER).ok).toBe(true)
  })

  it('is a no-op (started:false) when already installed', () => {
    const p = makePlugin('installed')
    const r = p.beginInstall('u', LATER)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.started).toBe(false)
    expect(p.status).toBe('installed')
    expect(p.pullEvents()).toHaveLength(0)
  })

  it('is a no-op (started:false) when already installing', () => {
    const p = makePlugin('installing')
    const r = p.beginInstall('u', LATER)
    expect(r.ok && r.value.started).toBe(false)
  })

  it('fails when there is no piece package to install', () => {
    const p = makePlugin('available', null)
    const r = p.beginInstall('u', LATER)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Plugin has no piece name')
  })
})

describe('Plugin.completeInstall', () => {
  it('moves installing -> installed and stamps installedAt', () => {
    const p = makePlugin('installing')
    p.completeInstall(LATER)
    expect(p.status).toBe('installed')
    expect(p.installedAt).toBe(LATER)
    expect(p.pullEvents().map((e) => e.name)).toContain('plugins.PluginInstalled')
  })
})

describe('Plugin.failInstall', () => {
  it('moves installing -> error and records the reason', () => {
    const p = makePlugin('installing')
    p.failInstall('npm exploded', LATER)
    expect(p.status).toBe('error')
    expect(p.pullEvents().map((e) => e.name)).toContain('plugins.PluginInstallFailed')
  })
})

describe('Plugin.uninstall', () => {
  it('resets to available and clears install metadata + config', () => {
    const p = makePlugin('installed')
    p.configure({ apiKey: 'secret' }, NOW)
    p.pullEvents()
    p.uninstall(LATER)
    expect(p.status).toBe('available')
    expect(p.installedAt).toBeNull()
    expect(p.installedBy).toBeNull()
    expect(p.config).toEqual({})
    expect(p.pullEvents().map((e) => e.name)).toContain('plugins.PluginUninstalled')
  })
})

describe('Plugin.setEnabled', () => {
  it('toggles installed -> disabled', () => {
    const p = makePlugin('installed')
    const r = p.setEnabled(false, LATER)
    expect(r.ok).toBe(true)
    expect(p.status).toBe('disabled')
    expect(p.pullEvents().map((e) => e.name)).toContain('plugins.PluginDisabled')
  })

  it('toggles disabled -> installed', () => {
    const p = makePlugin('disabled')
    const r = p.setEnabled(true, LATER)
    expect(r.ok).toBe(true)
    expect(p.status).toBe('installed')
    expect(p.pullEvents().map((e) => e.name)).toContain('plugins.PluginEnabled')
  })

  it('rejects toggling a plugin that is not installed', () => {
    expect(makePlugin('available').setEnabled(false, LATER).ok).toBe(false)
    expect(makePlugin('installing').setEnabled(true, LATER).ok).toBe(false)
  })
})

describe('Plugin.configure', () => {
  it('replaces the config bag and records an event', () => {
    const p = makePlugin('installed')
    p.configure({ token: 'abc' }, LATER)
    expect(p.config).toEqual({ token: 'abc' })
    expect(p.pullEvents().map((e) => e.name)).toContain('plugins.PluginConfigured')
  })
})

describe('Plugin.fromCatalog', () => {
  it('creates a brand-new available plugin from a catalog entry', () => {
    const p = Plugin.fromCatalog(PluginId.of('p2'), {
      name: 'Slack',
      description: 'd',
      version: '2.0.0',
      category: 'chat',
      pieceName: 'piece-slack',
      authType: 'OAUTH2',
      icon: null,
      source: 'piece',
      manifest: null,
      now: NOW,
    })
    expect(p.status).toBe('available')
    expect(p.installedAt).toBeNull()
    expect(p.config).toEqual({})
  })
})
