import { describe, it, expect } from 'vitest'
import { FileShare, FileShareSnapshot } from '@/contexts/files/domain/FileShare'
import { FileId, FileShareId } from '@/contexts/files/domain/ids'

const NOW = new Date('2026-01-01T00:00:00Z')
const LATER = new Date('2026-01-02T00:00:00Z')

describe('FileShare.create', () => {
  it('records a viewer grant with FileShared', () => {
    const share = FileShare.create(FileShareId.of('s1'), FileId.of('f1'), 'u2', 'viewer', NOW)
    expect(share.fileId.value).toBe('f1')
    expect(share.userId).toBe('u2')
    expect(share.access).toBe('viewer')
    expect(share.createdAt).toBe(NOW)
    const evs = share.pullEvents() as Array<{ name: string; access: string }>
    expect(evs[0].name).toBe('files.FileShared')
    expect(evs[0].access).toBe('viewer')
  })

  it('supports an editor grant', () => {
    const share = FileShare.create(FileShareId.of('s1'), FileId.of('f1'), 'u2', 'editor', NOW)
    expect(share.access).toBe('editor')
  })
})

describe('FileShare.changeAccess', () => {
  it('updates the level and records FileAccessChanged', () => {
    const share = FileShare.create(FileShareId.of('s1'), FileId.of('f1'), 'u2', 'viewer', NOW)
    share.pullEvents()
    share.changeAccess('editor', LATER)
    expect(share.access).toBe('editor')
    const evs = share.pullEvents() as Array<{ name: string; access: string }>
    expect(evs[0].name).toBe('files.FileAccessChanged')
    expect(evs[0].access).toBe('editor')
  })
})

describe('FileShare.revoke', () => {
  it('records FileUnshared without mutating the access level', () => {
    const share = FileShare.create(FileShareId.of('s1'), FileId.of('f1'), 'u2', 'viewer', NOW)
    share.pullEvents()
    share.revoke(LATER)
    expect(share.pullEvents().map((e) => e.name)).toEqual(['files.FileUnshared'])
  })
})

describe('FileShare.rehydrate', () => {
  it('restores the grant without recording an event', () => {
    const snap: FileShareSnapshot = { fileId: 'f1', userId: 'u2', access: 'editor', createdAt: NOW }
    const share = FileShare.rehydrate(FileShareId.of('s1'), snap)
    expect(share.fileId.value).toBe('f1')
    expect(share.userId).toBe('u2')
    expect(share.access).toBe('editor')
    expect(share.pullEvents()).toHaveLength(0)
  })
})
