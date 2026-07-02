import { describe, it, expect } from 'vitest'
import { ManageSavedViewService } from '@/contexts/data/application/use-cases/ManageSavedViewService'
import { SavedViewRepository } from '@/contexts/data/application/ports/out/SavedViewRepository'
import { SavedView } from '@/contexts/data/domain/SavedView'
import { SavedViewId } from '@/contexts/data/domain/SavedViewId'

class FakeSavedViewRepository implements SavedViewRepository {
  store = new Map<string, SavedView>()
  deleted: string[] = []
  private seq = 0
  nextId(): SavedViewId {
    return SavedViewId.of(`view-${++this.seq}`)
  }
  async findById(id: SavedViewId): Promise<SavedView | null> {
    return this.store.get(id.value) ?? null
  }
  async save(view: SavedView): Promise<void> {
    this.store.set(view.id.value, view)
  }
  async delete(id: SavedViewId): Promise<void> {
    this.deleted.push(id.value)
    this.store.delete(id.value)
  }
}

const seedOwned = (repo: FakeSavedViewRepository, ownerId = 'owner'): SavedView => {
  const v = SavedView.create(SavedViewId.of('view-seed'), 'ent-1', ownerId, { name: 'Mine', isPublic: true })
  if (!v.ok) throw new Error(v.error)
  repo.store.set('view-seed', v.value)
  return v.value
}

describe('ManageSavedViewService', () => {
  it('creates a view and returns its new id', async () => {
    const repo = new FakeSavedViewRepository()
    const service = new ManageSavedViewService(repo)
    const r = await service.execute({
      action: 'create',
      actorId: 'u1',
      entityId: 'ent-1',
      name: 'Open',
      viewType: 'kanban',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.id).toBe('view-1')
    expect(repo.store.get('view-1')!.viewType).toBe('kanban')
  })

  it('fails to create with an empty name', async () => {
    const repo = new FakeSavedViewRepository()
    const service = new ManageSavedViewService(repo)
    const r = await service.execute({ action: 'create', actorId: 'u1', entityId: 'ent-1', name: '  ' })
    expect(r.ok).toBe(false)
    expect(repo.store.size).toBe(0)
  })

  it('updates an owned view', async () => {
    const repo = new FakeSavedViewRepository()
    seedOwned(repo)
    const service = new ManageSavedViewService(repo)
    const r = await service.execute({ action: 'update', actorId: 'owner', viewId: 'view-seed', name: 'Renamed' })
    expect(r.ok).toBe(true)
    expect(repo.store.get('view-seed')!.name).toBe('Renamed')
  })

  it('refuses to update a view owned by someone else', async () => {
    const repo = new FakeSavedViewRepository()
    seedOwned(repo)
    const service = new ManageSavedViewService(repo)
    const r = await service.execute({ action: 'update', actorId: 'intruder', viewId: 'view-seed', name: 'X' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('only the owner can edit')
  })

  it('fails to update a missing view', async () => {
    const repo = new FakeSavedViewRepository()
    const service = new ManageSavedViewService(repo)
    const r = await service.execute({ action: 'update', actorId: 'owner', viewId: 'nope', name: 'X' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('view not found')
  })

  it('deletes an owned view', async () => {
    const repo = new FakeSavedViewRepository()
    seedOwned(repo)
    const service = new ManageSavedViewService(repo)
    const r = await service.execute({ action: 'delete', actorId: 'owner', viewId: 'view-seed' })
    expect(r.ok).toBe(true)
    expect(repo.deleted).toEqual(['view-seed'])
  })

  it('refuses to delete a view owned by someone else', async () => {
    const repo = new FakeSavedViewRepository()
    seedOwned(repo)
    const service = new ManageSavedViewService(repo)
    const r = await service.execute({ action: 'delete', actorId: 'intruder', viewId: 'view-seed' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('only the owner can delete')
    expect(repo.deleted).toHaveLength(0)
  })

  it('clones any (public) view into a new private copy for the actor', async () => {
    const repo = new FakeSavedViewRepository()
    seedOwned(repo)
    const service = new ManageSavedViewService(repo)
    const r = await service.execute({ action: 'clone', actorId: 'u2', viewId: 'view-seed' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.id).toBe('view-1')
    const clone = repo.store.get('view-1')!
    expect(clone.ownerId).toBe('u2')
    expect(clone.isPublic).toBe(false)
    expect(clone.name).toBe('Mine (copy)')
  })

  it('fails to clone a missing view', async () => {
    const repo = new FakeSavedViewRepository()
    const service = new ManageSavedViewService(repo)
    const r = await service.execute({ action: 'clone', actorId: 'u2', viewId: 'nope' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('view not found')
  })
})
