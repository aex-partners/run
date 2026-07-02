import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import { DrizzlePluginStoreRepository } from '@/contexts/plugins/adapters/out/persistence/DrizzlePluginStoreRepository'
import { PluginStoreEntry } from '@/contexts/plugins/domain/PluginStoreEntry'

const NOW = new Date('2024-01-01T00:00:00.000Z')

describeIntegration('DrizzlePluginStoreRepository (integration)', () => {
  let db: Database
  let repo: DrizzlePluginStoreRepository

  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzlePluginStoreRepository(db)
  })

  it('puts then gets an entry by its (pluginName, scope, scopeId, key) identity', async () => {
    const pluginName = `piece-gmail-${randomUUID()}`
    const key = `k-${randomUUID()}`
    const entry = PluginStoreEntry.create({
      id: repo.nextId(),
      pluginName,
      scope: 'project',
      scopeId: null,
      key,
      value: { lastCursor: 42, tag: 'x' },
      now: NOW,
    })
    await repo.put(entry)

    const found = await repo.get({ pluginName, scope: 'project', scopeId: null, key })
    expect(found).not.toBeNull()
    expect(found!.value).toEqual({ lastCursor: 42, tag: 'x' })
    expect(found!.scopeId).toBeNull()
  })

  it('returns null for a missing entry', async () => {
    const found = await repo.get({
      pluginName: `missing-${randomUUID()}`,
      scope: 'project',
      scopeId: null,
      key: 'nope',
    })
    expect(found).toBeNull()
  })

  it('put overwrites the value of an existing identity (upsert), keeping one row', async () => {
    const pluginName = `piece-x-${randomUUID()}`
    const key = `k-${randomUUID()}`
    const first = PluginStoreEntry.create({
      id: repo.nextId(),
      pluginName,
      scope: 'flow',
      scopeId: 'flow-1',
      key,
      value: { n: 1 },
      now: NOW,
    })
    await repo.put(first)

    const second = PluginStoreEntry.create({
      id: repo.nextId(),
      pluginName,
      scope: 'flow',
      scopeId: 'flow-1',
      key,
      value: { n: 2 },
      now: new Date('2024-02-01T00:00:00.000Z'),
    })
    await repo.put(second)

    const found = await repo.get({ pluginName, scope: 'flow', scopeId: 'flow-1', key })
    expect(found!.value).toEqual({ n: 2 })
  })

  it('distinguishes a null scopeId (project) from a set scopeId (flow)', async () => {
    const pluginName = `piece-scope-${randomUUID()}`
    const key = `k-${randomUUID()}`
    await repo.put(
      PluginStoreEntry.create({
        id: repo.nextId(),
        pluginName,
        scope: 'project',
        scopeId: null,
        key,
        value: { scope: 'project' },
        now: NOW,
      }),
    )
    await repo.put(
      PluginStoreEntry.create({
        id: repo.nextId(),
        pluginName,
        scope: 'flow',
        scopeId: 'flow-9',
        key,
        value: { scope: 'flow' },
        now: NOW,
      }),
    )

    expect((await repo.get({ pluginName, scope: 'project', scopeId: null, key }))!.value).toEqual({ scope: 'project' })
    expect((await repo.get({ pluginName, scope: 'flow', scopeId: 'flow-9', key }))!.value).toEqual({ scope: 'flow' })
  })

  it('deletes an entry', async () => {
    const pluginName = `piece-del-${randomUUID()}`
    const key = `k-${randomUUID()}`
    await repo.put(
      PluginStoreEntry.create({
        id: repo.nextId(),
        pluginName,
        scope: 'project',
        scopeId: null,
        key,
        value: { gone: false },
        now: NOW,
      }),
    )
    await repo.delete({ pluginName, scope: 'project', scopeId: null, key })
    expect(await repo.get({ pluginName, scope: 'project', scopeId: null, key })).toBeNull()
  })
})
