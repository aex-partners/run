import { describe, it, expect } from 'vitest'
import {
  FolderService,
  createFolderPort,
  deleteFolderPort,
  renameFolderPort,
  reorderFoldersPort,
} from '@/contexts/automation/application/use-cases/FolderService'
import { InMemoryFlowFolderRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowFolderRepository'
import { FlowFolderId } from '@/contexts/automation/domain/ids'

const fakeClock = { now: () => new Date(0) }

describe('FolderService', () => {
  it('creates a folder and persists it', async () => {
    const folders = new InMemoryFlowFolderRepository()
    const svc = new FolderService(folders, fakeClock)

    const r = await svc.create({ displayName: 'Inbox' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const saved = await folders.findById(FlowFolderId.of(r.value.id))
    expect(saved!.displayName).toBe('Inbox')
    expect(saved!.displayOrder).toBe(0)
  })

  it('renames an existing folder', async () => {
    const folders = new InMemoryFlowFolderRepository()
    const svc = new FolderService(folders, fakeClock)
    const created = await svc.create({ displayName: 'Old' })
    if (!created.ok) return

    const r = await svc.rename({ id: created.value.id, displayName: 'New' })
    expect(r.ok).toBe(true)
    const saved = await folders.findById(FlowFolderId.of(created.value.id))
    expect(saved!.displayName).toBe('New')
  })

  it('fails to rename a missing folder', async () => {
    const svc = new FolderService(new InMemoryFlowFolderRepository(), fakeClock)
    const r = await svc.rename({ id: 'missing', displayName: 'x' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('RenameFolder: folder not found')
  })

  it('removes a folder', async () => {
    const folders = new InMemoryFlowFolderRepository()
    const svc = new FolderService(folders, fakeClock)
    const created = await svc.create({ displayName: 'Trash me' })
    if (!created.ok) return

    const r = await svc.remove({ id: created.value.id })
    expect(r.ok).toBe(true)
    expect(await folders.findById(FlowFolderId.of(created.value.id))).toBeNull()
  })

  it('reorders folders by their index in the list and skips missing ids', async () => {
    const folders = new InMemoryFlowFolderRepository()
    const svc = new FolderService(folders, fakeClock)
    const a = await svc.create({ displayName: 'A' })
    const b = await svc.create({ displayName: 'B' })
    if (!a.ok || !b.ok) return

    // 'gap' does not exist -> skipped (continue), b at index 2.
    const r = await svc.reorder({ folderIds: [b.value.id, 'gap', a.value.id] })
    expect(r.ok).toBe(true)
    expect((await folders.findById(FlowFolderId.of(b.value.id)))!.displayOrder).toBe(0)
    expect((await folders.findById(FlowFolderId.of(a.value.id)))!.displayOrder).toBe(2)
  })

  it('exposes each operation as its own in-port adapter', async () => {
    const folders = new InMemoryFlowFolderRepository()
    const svc = new FolderService(folders, fakeClock)

    const created = await createFolderPort(svc).execute({ displayName: 'Ported' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect((await renameFolderPort(svc).execute({ id: created.value.id, displayName: 'Renamed' })).ok).toBe(true)
    expect((await reorderFoldersPort(svc).execute({ folderIds: [created.value.id] })).ok).toBe(true)
    expect((await deleteFolderPort(svc).execute({ id: created.value.id })).ok).toBe(true)
    expect(await folders.findById(FlowFolderId.of(created.value.id))).toBeNull()
  })
})
