import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzlePluginRepository } from '@/contexts/plugins/adapters/out/persistence/DrizzlePluginRepository'
import { Plugin } from '@/contexts/plugins/domain/Plugin'
import { PluginId } from '@/contexts/plugins/domain/ids'
import { PluginStatus } from '@/contexts/plugins/domain/PluginStatus'

const NOW = new Date('2024-01-01T00:00:00.000Z')

describeIntegration('DrizzlePluginRepository (integration)', () => {
  let db: Database
  let repo: DrizzlePluginRepository

  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzlePluginRepository(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'Tester', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  function makePlugin(status: PluginStatus, installedBy: string | null, config: Record<string, unknown> = {}): Plugin {
    return Plugin.rehydrate({
      id: PluginId.of(`p-${randomUUID()}`),
      name: 'Gmail',
      description: 'Email piece',
      version: '1.0.0',
      author: null,
      icon: 'https://cdn/gmail.png',
      category: 'communication',
      manifest: null,
      pieceName: `piece-gmail-${randomUUID()}`,
      authType: 'oauth2',
      source: 'piece',
      sourceUrl: null,
      status,
      config,
      installedAt: status === 'available' ? null : NOW,
      installedBy,
      updatedAt: NOW,
    })
  }

  it('round-trips the aggregate through save -> findById', async () => {
    const userId = await seedUser()
    const plugin = makePlugin('installed', userId, { apiKey: 'k' })
    await repo.save(plugin)

    const found = await repo.findById(plugin.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('Gmail')
    expect(found!.status).toBe('installed')
    expect(found!.pieceName).toBe(plugin.pieceName)
    expect(found!.config).toEqual({ apiKey: 'k' })
    expect(found!.installedBy).toBe(userId)
  })

  it('findInstalled returns only installed plugins', async () => {
    const userId = await seedUser()
    const installed = makePlugin('installed', userId)
    const available = makePlugin('available', null)
    await repo.save(installed)
    await repo.save(available)

    const rows = await repo.findInstalled()
    const ids = rows.map((p) => p.id.value)
    expect(ids).toContain(installed.id.value)
    expect(ids).not.toContain(available.id.value)
  })

  it('upserts on save (the same id updates instead of duplicating)', async () => {
    const userId = await seedUser()
    const plugin = makePlugin('available', null)
    await repo.save(plugin)

    plugin.beginInstall(userId, NOW)
    plugin.completeInstall(NOW)
    plugin.configure({ token: 'abc' }, NOW)
    await repo.save(plugin)

    const found = await repo.findById(plugin.id)
    expect(found!.status).toBe('installed')
    expect(found!.config).toEqual({ token: 'abc' })

    const all = await db.select().from(schema.plugins)
    expect(all.filter((r) => r.id === plugin.id.value)).toHaveLength(1)
  })

  it('returns null for an unknown id', async () => {
    expect(await repo.findById(PluginId.of(`missing-${randomUUID()}`))).toBeNull()
  })
})
