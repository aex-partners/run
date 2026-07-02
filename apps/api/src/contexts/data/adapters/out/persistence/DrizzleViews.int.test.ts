import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleSavedViewRepository } from '@/contexts/data/adapters/out/persistence/DrizzleSavedViewRepository'
import { DrizzleListSavedViews } from '@/contexts/data/adapters/out/persistence/DrizzleListSavedViews'
import { DrizzleViewPreferenceRepository } from '@/contexts/data/adapters/out/persistence/DrizzleViewPreferenceRepository'
import { DrizzleGetViewPreference } from '@/contexts/data/adapters/out/persistence/DrizzleGetViewPreference'
import { SavedView } from '@/contexts/data/domain/SavedView'
import { SavedViewId } from '@/contexts/data/domain/SavedViewId'
import { UserViewPreference } from '@/contexts/data/domain/UserViewPreference'
import { ViewPreferenceId } from '@/contexts/data/domain/ViewPreferenceId'

// saved_views and user_view_preferences carry FKs to users + entities. Each test
// seeds fresh ids and scopes its reads to its own entity (parallel-safe).
describeIntegration('Drizzle saved views + view preferences (integration)', () => {
  let db: Database
  beforeAll(() => {
    db = getTestDb()
  })

  const seedUser = async (): Promise<string> => {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.test`, emailVerified: false })
    return id
  }

  const seedEntity = async (createdBy: string): Promise<string> => {
    const id = `e-${randomUUID()}`
    await db.insert(schema.entities).values({
      id,
      name: `Ent ${id}`,
      slug: `ent_${id.replace(/-/g, '')}`,
      fields: '[]',
      createdBy,
    })
    return id
  }

  it('DrizzleSavedViewRepository round-trips a saved view and upserts on save', async () => {
    const repo = new DrizzleSavedViewRepository(db)
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    const created = SavedView.create(SavedViewId.of(`sv-${randomUUID()}`), entityId, userId, {
      name: 'Open Deals',
      isPublic: true,
      viewType: 'kanban',
      filters: [{ field: 'status', op: 'eq', value: 'open' }],
      config: { kanban: { groupBy: 'status' } },
    })
    if (!created.ok) throw new Error(created.error)
    await repo.save(created.value)

    const found = await repo.findById(created.value.id)
    expect(found).not.toBeNull()
    if (!found) return
    expect(found.name).toBe('Open Deals')
    expect(found.ownerId).toBe(userId)
    expect(found.isPublic).toBe(true)
    expect(found.viewType).toBe('kanban')
    expect(found.filters).toEqual([{ field: 'status', op: 'eq', value: 'open' }])
    expect(found.config).toEqual({ kanban: { groupBy: 'status' } })

    // Re-save after an owner edit -> ON CONFLICT update.
    found.update(userId, { name: 'Renamed', isPublic: false })
    await repo.save(found)
    const reread = await repo.findById(created.value.id)
    expect(reread?.name).toBe('Renamed')
    expect(reread?.isPublic).toBe(false)

    await repo.delete(created.value.id)
    expect(await repo.findById(created.value.id)).toBeNull()
  })

  it('DrizzleListSavedViews returns own + public views with the isOwner flag', async () => {
    const repo = new DrizzleSavedViewRepository(db)
    const list = new DrizzleListSavedViews(db)
    const owner = await seedUser()
    const other = await seedUser()
    const entityId = await seedEntity(owner)

    const mkView = async (ownerId: string, name: string, isPublic: boolean): Promise<string> => {
      const v = SavedView.create(SavedViewId.of(`sv-${randomUUID()}`), entityId, ownerId, { name, isPublic })
      if (!v.ok) throw new Error(v.error)
      await repo.save(v.value)
      return v.value.id.value
    }
    const ownerPrivate = await mkView(owner, 'Owner Private', false)
    const ownerPublic = await mkView(owner, 'Owner Public', true)
    const otherPrivate = await mkView(other, 'Other Private', false)

    const forOther = await list.execute({ entityId, userId: other })
    const ids = forOther.map((v) => v.id).sort()
    // 'other' sees the public view and their own private one, not the owner's private one.
    expect(ids).toEqual([ownerPublic, otherPrivate].sort())
    expect(ids).not.toContain(ownerPrivate)
    const otherOwn = forOther.find((v) => v.id === otherPrivate)
    expect(otherOwn?.isOwner).toBe(true)
    const publicOne = forOther.find((v) => v.id === ownerPublic)
    expect(publicOne?.isOwner).toBe(false)
  })

  it('view preferences upsert on (user, entity) and read back via GetViewPreference', async () => {
    const repo = new DrizzleViewPreferenceRepository(db)
    const get = new DrizzleGetViewPreference(db)
    const userId = await seedUser()
    const entityId = await seedEntity(userId)

    expect(await get.execute({ userId, entityId })).toBeNull()
    expect(await repo.findByUserEntity(userId, entityId)).toBeNull()

    const pref = UserViewPreference.create(ViewPreferenceId.of(`vp-${randomUUID()}`), userId, entityId, 'table', {
      table: { sort: 'name' },
    })
    await repo.save(pref)

    expect(await get.execute({ userId, entityId })).toEqual({ activeView: 'table', config: { table: { sort: 'name' } } })

    // A second save for the same (user, entity) upserts (different surrogate id).
    const pref2 = UserViewPreference.create(ViewPreferenceId.of(`vp-${randomUUID()}`), userId, entityId, 'map', {
      map: { lat: 'latitude' },
    })
    await repo.save(pref2)
    const after = await get.execute({ userId, entityId })
    expect(after?.activeView).toBe('map')
    expect(after?.config).toEqual({ map: { lat: 'latitude' } })

    const reread = await repo.findByUserEntity(userId, entityId)
    expect(reread?.activeView).toBe('map')
  })
})
