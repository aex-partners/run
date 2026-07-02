import { describe, it, expect } from 'vitest'
import { SetViewPreferenceService } from '@/contexts/data/application/use-cases/SetViewPreferenceService'
import { ViewPreferenceRepository } from '@/contexts/data/application/ports/out/ViewPreferenceRepository'
import { UserViewPreference } from '@/contexts/data/domain/UserViewPreference'
import { ViewPreferenceId } from '@/contexts/data/domain/ViewPreferenceId'

class FakeViewPreferenceRepository implements ViewPreferenceRepository {
  store = new Map<string, UserViewPreference>() // keyed by `${userId}:${entityId}`
  saved: UserViewPreference[] = []
  private seq = 0
  nextId(): ViewPreferenceId {
    return ViewPreferenceId.of(`pref-${++this.seq}`)
  }
  async findByUserEntity(userId: string, entityId: string): Promise<UserViewPreference | null> {
    return this.store.get(`${userId}:${entityId}`) ?? null
  }
  async save(pref: UserViewPreference): Promise<void> {
    this.saved.push(pref)
    this.store.set(`${pref.userId}:${pref.entityId}`, pref)
  }
}

describe('SetViewPreferenceService', () => {
  it('creates a new preference when none exists', async () => {
    const repo = new FakeViewPreferenceRepository()
    const service = new SetViewPreferenceService(repo)
    const r = await service.execute({
      userId: 'u1',
      entityId: 'ent-1',
      activeView: 'kanban',
      config: { kanban: { groupBy: 'status' } },
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.activeView).toBe('kanban')
    expect(r.value.config).toEqual({ kanban: { groupBy: 'status' } })
    expect(repo.store.get('u1:ent-1')).toBeDefined()
  })

  it('shallow-merges config per top-level view key on an existing preference', async () => {
    const repo = new FakeViewPreferenceRepository()
    const existing = UserViewPreference.create(ViewPreferenceId.of('pref-0'), 'u1', 'ent-1', 'table', {
      table: { sort: 'name' },
    })
    repo.store.set('u1:ent-1', existing)
    const service = new SetViewPreferenceService(repo)

    const r = await service.execute({ userId: 'u1', entityId: 'ent-1', config: { gallery: { cover: 'img' } } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // table key preserved, gallery key added; activeView untouched.
    expect(r.value.config).toEqual({ table: { sort: 'name' }, gallery: { cover: 'img' } })
    expect(r.value.activeView).toBe('table')
  })

  it('updates activeView without clobbering config when config is omitted', async () => {
    const repo = new FakeViewPreferenceRepository()
    const existing = UserViewPreference.create(ViewPreferenceId.of('pref-0'), 'u1', 'ent-1', 'table', {
      table: { sort: 'name' },
    })
    repo.store.set('u1:ent-1', existing)
    const service = new SetViewPreferenceService(repo)

    const r = await service.execute({ userId: 'u1', entityId: 'ent-1', activeView: 'map' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.activeView).toBe('map')
    expect(r.value.config).toEqual({ table: { sort: 'name' } })
  })
})
