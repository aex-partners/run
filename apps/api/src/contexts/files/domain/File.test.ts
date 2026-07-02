import { describe, it, expect } from 'vitest'
import { File, FileSnapshot } from '@/contexts/files/domain/File'
import { FileId } from '@/contexts/files/domain/ids'

const NOW = new Date('2026-01-01T00:00:00Z')
const LATER = new Date('2026-01-02T00:00:00Z')
const fid = (v: string) => FileId.of(v)

const names = (file: File) => file.pullEvents().map((e) => e.name)

describe('File.upload', () => {
  it('creates a byte-bearing file, deriving type and mime from the name', () => {
    const res = File.upload(fid('f1'), { name: 'report.pdf', size: 100, path: 'store/f1', source: 'upload', ownerId: 'u1' }, NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const f = res.value
    expect(f.name).toBe('report.pdf')
    expect(f.type).toBe('pdf')
    expect(f.mimeType).toBe('application/pdf')
    expect(f.size).toBe(100)
    expect(f.path).toBe('store/f1')
    expect(f.isFolder).toBe(false)
    expect(f.starred).toBe(false)
    expect(f.aiIndexed).toBe(false)
    expect(f.publicToken).toBeNull()
    expect(f.deletedAt).toBeNull()
    expect(f.parentId).toBeNull()
    expect(f.ownerId).toBe('u1')
    expect(names(f)).toEqual(['files.FileUploaded'])
  })

  it('links to a parent folder when parentId is given', () => {
    const res = File.upload(
      fid('f1'),
      { name: 'a.txt', size: 1, path: 'p', source: 'upload', ownerId: 'u1', parentId: 'folder-1' },
      NOW,
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.parentId?.value).toBe('folder-1')
  })

  it('trims the name and rejects a blank one', () => {
    const ok = File.upload(fid('f1'), { name: '  a.txt  ', size: 1, path: 'p', source: 'upload', ownerId: 'u1' }, NOW)
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.value.name).toBe('a.txt')
    const bad = File.upload(fid('f1'), { name: '   ', size: 1, path: 'p', source: 'upload', ownerId: 'u1' }, NOW)
    expect(bad.ok).toBe(false)
  })

  it('rejects a negative size and a blank path', () => {
    expect(File.upload(fid('f1'), { name: 'a.txt', size: -1, path: 'p', source: 'upload', ownerId: 'u1' }, NOW).ok).toBe(
      false,
    )
    expect(File.upload(fid('f1'), { name: 'a.txt', size: 1, path: '  ', source: 'upload', ownerId: 'u1' }, NOW).ok).toBe(
      false,
    )
  })
})

describe('File.createFolder', () => {
  it('creates a folder with no bytes, no path, size 0', () => {
    const res = File.createFolder(fid('d1'), 'Docs', 'u1', null, NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const d = res.value
    expect(d.isFolder).toBe(true)
    expect(d.type).toBe('folder')
    expect(d.mimeType).toBeNull()
    expect(d.size).toBe(0)
    expect(d.path).toBeNull()
    expect(d.source).toBe('upload')
    expect(names(d)).toEqual(['files.FolderCreated'])
  })

  it('nests under a parent and trims the name; rejects blank', () => {
    const res = File.createFolder(fid('d1'), '  Nested  ', 'u1', 'parent-1', NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.name).toBe('Nested')
    expect(res.value.parentId?.value).toBe('parent-1')
    expect(File.createFolder(fid('d2'), '   ', 'u1', null, NOW).ok).toBe(false)
  })
})

describe('File.rehydrate', () => {
  it('restores every field from the snapshot', () => {
    const snap: FileSnapshot = {
      name: 'x.png',
      type: 'png',
      mimeType: 'image/png',
      size: 5,
      path: 'store/x',
      source: 'email',
      sourceRef: 'msg-1',
      parentId: 'folder-1',
      isFolder: false,
      starred: true,
      aiIndexed: true,
      publicToken: 'tok',
      deletedAt: LATER,
      ownerId: 'u1',
      createdAt: NOW,
      updatedAt: LATER,
    }
    const f = File.rehydrate(fid('f1'), snap)
    expect(f.name).toBe('x.png')
    expect(f.source).toBe('email')
    expect(f.sourceRef).toBe('msg-1')
    expect(f.parentId?.value).toBe('folder-1')
    expect(f.starred).toBe(true)
    expect(f.aiIndexed).toBe(true)
    expect(f.publicToken).toBe('tok')
    expect(f.deletedAt).toBe(LATER)
    expect(f.pullEvents()).toHaveLength(0)
  })
})

describe('File mutations', () => {
  const fresh = () =>
    (File.upload(fid('f1'), { name: 'a.txt', size: 1, path: 'p', source: 'upload', ownerId: 'u1' }, NOW) as {
      ok: true
      value: File
    }).value

  it('rename trims, updates, bumps updatedAt and records FileRenamed', () => {
    const f = fresh()
    f.pullEvents()
    const res = f.rename('  b.txt  ', LATER)
    expect(res.ok).toBe(true)
    expect(f.name).toBe('b.txt')
    expect(f.updatedAt).toBe(LATER)
    expect(names(f)).toEqual(['files.FileRenamed'])
    expect(f.rename('   ', LATER).ok).toBe(false)
  })

  it('move sets the parent and records FileMoved', () => {
    const f = fresh()
    f.pullEvents()
    const res = f.move(fid('folder-9'), LATER)
    expect(res.ok).toBe(true)
    expect(f.parentId?.value).toBe('folder-9')
    const evs = f.pullEvents() as Array<{ name: string; parentId: string | null }>
    expect(evs[0].name).toBe('files.FileMoved')
    expect(evs[0].parentId).toBe('folder-9')
  })

  it('move to null detaches to the root', () => {
    const f = fresh()
    f.move(fid('folder-9'), LATER)
    f.pullEvents()
    const res = f.move(null, LATER)
    expect(res.ok).toBe(true)
    expect(f.parentId).toBeNull()
  })

  it('move guards against making a file its own parent', () => {
    const f = fresh()
    f.pullEvents()
    const res = f.move(fid('f1'), LATER)
    expect(res.ok).toBe(false)
    expect(f.pullEvents()).toHaveLength(0)
  })

  it('toggleStar flips and records FileStarred', () => {
    const f = fresh()
    f.pullEvents()
    f.toggleStar(LATER)
    expect(f.starred).toBe(true)
    expect(names(f)).toEqual(['files.FileStarred'])
    f.toggleStar(LATER)
    expect(f.starred).toBe(false)
  })

  it('trash and restore flip deletedAt and record their events', () => {
    const f = fresh()
    f.pullEvents()
    f.trash(LATER)
    expect(f.deletedAt).toBe(LATER)
    expect(names(f)).toEqual(['files.FileTrashed'])
    f.restore(NOW)
    expect(f.deletedAt).toBeNull()
    expect(names(f)).toEqual(['files.FileRestored'])
  })

  it('markDeleted records FileDeleted without mutating state', () => {
    const f = fresh()
    f.pullEvents()
    f.markDeleted(LATER)
    expect(names(f)).toEqual(['files.FileDeleted'])
  })

  it('setAiIndexed flips and records FileAiIndexChanged', () => {
    const f = fresh()
    f.pullEvents()
    f.setAiIndexed(true, LATER)
    expect(f.aiIndexed).toBe(true)
    expect(names(f)).toEqual(['files.FileAiIndexChanged'])
  })

  it('setPublicToken mints/clears the token and reports enabled via FilePublicLinkChanged', () => {
    const f = fresh()
    f.pullEvents()
    f.setPublicToken('tok-123', LATER)
    expect(f.publicToken).toBe('tok-123')
    let evs = f.pullEvents() as Array<{ name: string; enabled: boolean }>
    expect(evs[0].name).toBe('files.FilePublicLinkChanged')
    expect(evs[0].enabled).toBe(true)

    f.setPublicToken(null, LATER)
    expect(f.publicToken).toBeNull()
    evs = f.pullEvents() as Array<{ name: string; enabled: boolean }>
    expect(evs[0].enabled).toBe(false)
  })
})
