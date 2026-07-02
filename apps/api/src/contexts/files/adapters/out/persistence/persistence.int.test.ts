import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { Result } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { File } from '@/contexts/files/domain/File'
import { FileShare } from '@/contexts/files/domain/FileShare'
import { FileId } from '@/contexts/files/domain/ids'
import { UserNames } from '@/contexts/files/application/ports/out/UserNames'
import { GrantFileAccessService } from '@/contexts/files/application/use-cases/GrantFileAccessService'
import { DrizzleFileRepository } from './DrizzleFileRepository'
import { DrizzleFileShareRepository } from './DrizzleFileShareRepository'
import { DrizzleListFiles } from './DrizzleListFiles'
import { DrizzleGetFile } from './DrizzleGetFile'
import { DrizzleCategoryCounts } from './DrizzleCategoryCounts'
import { DrizzleShareData } from './DrizzleShareData'

// ADAPTER INTEGRATION tests for the `files` context out-adapters, exercised
// against a REAL Postgres (TEST_DATABASE_URL). All suites live in one file so
// the within-file sequential ordering keeps the shared DB deterministic.

const OWNER = 'u-file-1'
const OWNER2 = 'u-file-2'
const SEEDED_USERS = ['u-file-1', 'u-file-2', 'u-file-3', 'u-file-4', 'u-file-5']
const NOW = new Date('2026-03-01T12:00:00.000Z')

const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(`expected ok Result, got: ${r.error}`)
  return r.value
}

const fixedClock = (now: Date): Clock => ({ now: () => now })

class NoopPublisher implements EventPublisher {
  publishCalls = 0
  async publish(): Promise<void> {
    this.publishCalls += 1
  }
}

// Fake of the UserNames ACL out-port. Real signature: names(ids) -> Map<id, {name,email}>.
const namesAll: UserNames = {
  names: async (ids: string[]) =>
    new Map(ids.map((i) => [i, { name: `User ${i}`, email: `${i}@x.test` }])),
}
// Variant that fails to resolve `skip`, so its share row is omitted from the view.
const namesSkipping = (skip: string): UserNames => ({
  names: async (ids: string[]) =>
    new Map(ids.filter((i) => i !== skip).map((i) => [i, { name: `User ${i}`, email: `${i}@x.test` }])),
})

describeIntegration('files persistence', () => {
  let db: Database

  // Raw row builder: undefined keys fall through to the column default.
  type FileInsert = typeof schema.files.$inferInsert
  const fileRow = (o: Partial<FileInsert> & { id: string }): FileInsert => ({
    id: o.id,
    name: o.name ?? 'doc.txt',
    type: o.type ?? 'txt',
    mimeType: o.mimeType,
    size: o.size,
    path: o.path,
    source: o.source ?? 'upload',
    sourceRef: o.sourceRef,
    parentId: o.parentId,
    isFolder: o.isFolder,
    starred: o.starred,
    aiIndexed: o.aiIndexed,
    publicToken: o.publicToken,
    deletedAt: o.deletedAt,
    ownerId: o.ownerId ?? OWNER,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  })

  const insertFile = (o: Partial<FileInsert> & { id: string }) => db.insert(schema.files).values(fileRow(o))

  const insertShare = (id: string, fileId: string, userId: string, access: 'viewer' | 'editor' = 'viewer') =>
    db.insert(schema.fileShares).values({ id, fileId, userId, access })

  beforeAll(async () => {
    db = getTestDb()
    // Seed FK prerequisites once; users are NOT truncated by the scoped reset.
    for (const id of SEEDED_USERS) {
      await db
        .insert(schema.users)
        .values({ id, name: `Name ${id}`, email: `${id}@x.test` })
        .onConflictDoNothing()
    }
  })

  // Scoped truncate (NOT the global resetDb) so parallel context suites do not race.
  beforeEach(async () => {
    await db.execute(sql.raw('TRUNCATE files, file_shares RESTART IDENTITY CASCADE'))
  })

  describe('DrizzleFileRepository', () => {
    const repo = () => new DrizzleFileRepository(db)

    it('round-trips an uploaded file through save -> findById', async () => {
      const r = repo()
      const id = r.nextId()
      const file = unwrap(
        File.upload(
          id,
          { name: 'report.pdf', size: 2048, path: '/storage/report.pdf', source: 'email', sourceRef: 'msg-1', ownerId: OWNER },
          NOW,
        ),
      )
      await r.save(file)

      const found = await r.findById(id)
      expect(found).not.toBeNull()
      expect(found!.id.value).toBe(id.value)
      expect(found!.name).toBe('report.pdf')
      expect(found!.type).toBe('pdf')
      expect(found!.mimeType).toBe('application/pdf')
      expect(found!.size).toBe(2048)
      expect(found!.path).toBe('/storage/report.pdf')
      expect(found!.source).toBe('email')
      expect(found!.sourceRef).toBe('msg-1')
      expect(found!.ownerId).toBe(OWNER)
      expect(found!.isFolder).toBe(false)
      expect(found!.starred).toBe(false)
      expect(found!.publicToken).toBeNull()
      expect(found!.deletedAt).toBeNull()
    })

    it('round-trips a folder created via File.createFolder', async () => {
      const r = repo()
      const id = r.nextId()
      const folder = unwrap(File.createFolder(id, 'Invoices', OWNER, null, NOW))
      await r.save(folder)

      const found = await r.findById(id)
      expect(found!.isFolder).toBe(true)
      expect(found!.type).toBe('folder')
      expect(found!.size).toBe(0)
      expect(found!.path).toBeNull()
    })

    it('save upserts on conflicting id (mutations are persisted)', async () => {
      const r = repo()
      const id = r.nextId()
      const file = unwrap(
        File.upload(id, { name: 'a.txt', size: 10, path: '/p/a.txt', source: 'upload', ownerId: OWNER }, NOW),
      )
      await r.save(file)

      unwrap(file.rename('renamed.txt', NOW))
      file.toggleStar(NOW)
      await r.save(file)

      const found = await r.findById(id)
      expect(found!.name).toBe('renamed.txt')
      expect(found!.starred).toBe(true)
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.files)
        .where(eq(schema.files.id, id.value))
      expect(count).toBe(1)
    })

    it('delete removes the row', async () => {
      const r = repo()
      const id = r.nextId()
      const file = unwrap(
        File.upload(id, { name: 'gone.txt', size: 1, path: '/p/gone.txt', source: 'upload', ownerId: OWNER }, NOW),
      )
      await r.save(file)
      await r.delete(file)
      expect(await r.findById(id)).toBeNull()
    })

    it('findById returns null for an unknown id', async () => {
      expect(await repo().findById(FileId.of('does-not-exist'))).toBeNull()
    })

    it('findTrashedByOwner returns only soft-deleted rows for that owner', async () => {
      // Two raw rows for OWNER: one trashed, one live; plus a trashed row for OWNER2.
      await insertFile({ id: 'f-trash-1', name: 'trashed.txt', ownerId: OWNER, deletedAt: NOW })
      await insertFile({ id: 'f-live-1', name: 'live.txt', ownerId: OWNER })
      await insertFile({ id: 'f-trash-other', name: 'other.txt', ownerId: OWNER2, deletedAt: NOW })

      const trashed = await repo().findTrashedByOwner(OWNER)
      expect(trashed.map((f) => f.id.value)).toEqual(['f-trash-1'])
      expect(trashed[0]!.deletedAt).not.toBeNull()
    })
  })

  describe('DrizzleFileShareRepository', () => {
    const repo = () => new DrizzleFileShareRepository(db)

    it('round-trips a share through save -> findByFileAndUser', async () => {
      await insertFile({ id: 'f-share-1', ownerId: OWNER })
      const r = repo()
      const share = FileShare.create(r.nextId(), FileId.of('f-share-1'), 'u-file-3', 'editor', NOW)
      await r.save(share)

      const found = await r.findByFileAndUser(FileId.of('f-share-1'), 'u-file-3')
      expect(found).not.toBeNull()
      expect(found!.fileId.value).toBe('f-share-1')
      expect(found!.userId).toBe('u-file-3')
      expect(found!.access).toBe('editor')
    })

    it('save upserts an access change in place', async () => {
      await insertFile({ id: 'f-share-2', ownerId: OWNER })
      const r = repo()
      const share = FileShare.create(r.nextId(), FileId.of('f-share-2'), 'u-file-3', 'viewer', NOW)
      await r.save(share)

      share.changeAccess('editor', NOW)
      await r.save(share)

      const found = await r.findByFileAndUser(FileId.of('f-share-2'), 'u-file-3')
      expect(found!.access).toBe('editor')
      const rows = await db.select().from(schema.fileShares).where(eq(schema.fileShares.fileId, 'f-share-2'))
      expect(rows).toHaveLength(1)
    })

    it('delete revokes the share', async () => {
      await insertFile({ id: 'f-share-3', ownerId: OWNER })
      const r = repo()
      const share = FileShare.create(r.nextId(), FileId.of('f-share-3'), 'u-file-3', 'viewer', NOW)
      await r.save(share)
      await r.delete(share)
      expect(await r.findByFileAndUser(FileId.of('f-share-3'), 'u-file-3')).toBeNull()
    })

    it('findByFileAndUser returns null when no grant exists', async () => {
      await insertFile({ id: 'f-share-4', ownerId: OWNER })
      expect(await repo().findByFileAndUser(FileId.of('f-share-4'), 'u-file-5')).toBeNull()
    })
  })

  describe('DrizzleListFiles', () => {
    const list = () => new DrizzleListFiles(db)
    const baseOpts = { ownerId: OWNER, category: 'all' as const, source: 'all' as const, limit: 50, offset: 0 }

    it('lists owner non-deleted nodes with folders first, then most-recent files', async () => {
      await insertFile({ id: 'f-folder', name: 'Folder', type: 'folder', isFolder: 1, updatedAt: new Date('2026-01-01T00:00:00Z') })
      await insertFile({ id: 'f-old', name: 'old.txt', updatedAt: new Date('2026-02-01T00:00:00Z') })
      await insertFile({ id: 'f-new', name: 'new.txt', updatedAt: new Date('2026-02-10T00:00:00Z') })

      const items = await list().execute(baseOpts)
      expect(items.map((i) => i.id)).toEqual(['f-folder', 'f-new', 'f-old'])
      const folder = items[0]!
      expect(folder.isFolder).toBe(true)
      expect(folder.previewUrl).toBeNull()
      expect(folder.downloadUrl).toBeNull()
      const file = items[1]!
      expect(file.previewUrl).toBe('/api/files/f-new/raw')
      expect(file.downloadUrl).toBe('/api/files/f-new/raw?download=1')
    })

    it('excludes trashed rows from a normal category and surfaces them under trash', async () => {
      await insertFile({ id: 'f-live', name: 'live.txt' })
      await insertFile({ id: 'f-dead', name: 'dead.txt', deletedAt: NOW })

      const live = await list().execute(baseOpts)
      expect(live.map((i) => i.id)).toEqual(['f-live'])

      const trash = await list().execute({ ...baseOpts, category: 'trash' })
      expect(trash.map((i) => i.id)).toEqual(['f-dead'])
    })

    it('filters by the starred category', async () => {
      await insertFile({ id: 'f-star', name: 'star.txt', starred: 1 })
      await insertFile({ id: 'f-plain', name: 'plain.txt', starred: 0 })

      const items = await list().execute({ ...baseOpts, category: 'starred' })
      expect(items.map((i) => i.id)).toEqual(['f-star'])
      expect(items[0]!.starred).toBe(true)
    })

    it('shared category matches a public token OR an existing file_shares row', async () => {
      await insertFile({ id: 'f-public', name: 'public.txt', publicToken: 'tok-list-1' })
      await insertFile({ id: 'f-granted', name: 'granted.txt' })
      await insertShare('sh-list-1', 'f-granted', 'u-file-3')
      await insertFile({ id: 'f-private', name: 'private.txt' })

      const items = await list().execute({ ...baseOpts, category: 'shared' })
      expect(items.map((i) => i.id).sort()).toEqual(['f-granted', 'f-public'])
      // The `shared` flag on the item mirrors only publicToken, not file_shares.
      const granted = items.find((i) => i.id === 'f-granted')!
      expect(granted.shared).toBe(false)
      const pub = items.find((i) => i.id === 'f-public')!
      expect(pub.shared).toBe(true)
    })

    it('filters by source', async () => {
      await insertFile({ id: 'f-email', name: 'e.txt', source: 'email' })
      await insertFile({ id: 'f-chat', name: 'c.txt', source: 'chat' })

      const items = await list().execute({ ...baseOpts, source: 'email' })
      expect(items.map((i) => i.id)).toEqual(['f-email'])
      expect(items[0]!.source).toBe('email')
    })

    it('search matches case-insensitively on the name', async () => {
      await insertFile({ id: 'f-budget', name: 'Quarterly BUDGET.xlsx' })
      await insertFile({ id: 'f-notes', name: 'notes.txt' })

      const items = await list().execute({ ...baseOpts, search: 'budget' })
      expect(items.map((i) => i.id)).toEqual(['f-budget'])
    })

    it('scopes results to the owner', async () => {
      await insertFile({ id: 'f-mine', name: 'mine.txt', ownerId: OWNER })
      await insertFile({ id: 'f-theirs', name: 'theirs.txt', ownerId: OWNER2 })

      const items = await list().execute(baseOpts)
      expect(items.map((i) => i.id)).toEqual(['f-mine'])
    })

    it('filters by parentId (root vs a specific folder)', async () => {
      await insertFile({ id: 'f-parent', name: 'Parent', type: 'folder', isFolder: 1 })
      await insertFile({ id: 'f-root', name: 'root.txt', parentId: null })
      await insertFile({ id: 'f-child', name: 'child.txt', parentId: 'f-parent' })

      const root = await list().execute({ ...baseOpts, parentId: null })
      expect(root.map((i) => i.id).sort()).toEqual(['f-parent', 'f-root'])

      const children = await list().execute({ ...baseOpts, parentId: 'f-parent' })
      expect(children.map((i) => i.id)).toEqual(['f-child'])
    })

    it('honors limit and offset', async () => {
      await insertFile({ id: 'f-1', name: 'a.txt', updatedAt: new Date('2026-02-03T00:00:00Z') })
      await insertFile({ id: 'f-2', name: 'b.txt', updatedAt: new Date('2026-02-02T00:00:00Z') })
      await insertFile({ id: 'f-3', name: 'c.txt', updatedAt: new Date('2026-02-01T00:00:00Z') })

      const page1 = await list().execute({ ...baseOpts, limit: 2, offset: 0 })
      expect(page1.map((i) => i.id)).toEqual(['f-1', 'f-2'])
      const page2 = await list().execute({ ...baseOpts, limit: 2, offset: 2 })
      expect(page2.map((i) => i.id)).toEqual(['f-3'])
    })
  })

  describe('DrizzleGetFile', () => {
    const get = () => new DrizzleGetFile(db)

    it('returns the detail view for an existing file', async () => {
      await insertFile({
        id: 'f-detail',
        name: 'spec.pdf',
        type: 'pdf',
        mimeType: 'application/pdf',
        size: 2048,
        source: 'upload',
        starred: 1,
        aiIndexed: 1,
        publicToken: 'tok-detail-1',
        ownerId: OWNER,
      })

      const detail = await get().execute({ id: 'f-detail' })
      expect(detail).not.toBeNull()
      expect(detail!.name).toBe('spec.pdf')
      expect(detail!.mimeType).toBe('application/pdf')
      expect(detail!.size).toBe('2.0 KB')
      expect(detail!.starred).toBe(true)
      expect(detail!.aiIndexed).toBe(true)
      expect(detail!.publicToken).toBe('tok-detail-1')
      expect(detail!.ownerId).toBe(OWNER)
      expect(detail!.isFolder).toBe(false)
      expect(detail!.previewUrl).toBe('/api/files/f-detail/raw')
    })

    it('nulls preview/download URLs for a folder', async () => {
      await insertFile({ id: 'f-detail-folder', name: 'Folder', type: 'folder', isFolder: 1 })
      const detail = await get().execute({ id: 'f-detail-folder' })
      expect(detail!.isFolder).toBe(true)
      expect(detail!.previewUrl).toBeNull()
      expect(detail!.downloadUrl).toBeNull()
    })

    it('returns null when the file is absent', async () => {
      expect(await get().execute({ id: 'nope' })).toBeNull()
    })
  })

  describe('DrizzleCategoryCounts', () => {
    const counts = () => new DrizzleCategoryCounts(db)

    it('buckets files into all/starred/recent/shared/trash for the owner', async () => {
      const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      // all (deleted_at IS NULL): a, b, d, e, old = 5 ; trash: c = 1
      await insertFile({ id: 'c-a', name: 'a.txt' }) // recent
      await insertFile({ id: 'c-b', name: 'b.txt', starred: 1 }) // starred + recent
      await insertFile({ id: 'c-c', name: 'c.txt', deletedAt: NOW }) // trash only
      await insertFile({ id: 'c-d', name: 'd.txt', publicToken: 'tok-count-1' }) // shared (token) + recent
      await insertFile({ id: 'c-e', name: 'e.txt' }) // shared (file_shares) + recent
      await insertShare('sh-count-1', 'c-e', 'u-file-3')
      await insertFile({ id: 'c-old', name: 'old.txt', updatedAt: old }) // all but not recent
      // Another owner's row must not leak into the counts.
      await insertFile({ id: 'c-other', name: 'other.txt', ownerId: OWNER2 })

      const result = await counts().execute({ ownerId: OWNER })
      expect(result).toEqual({ all: 5, starred: 1, recent: 4, shared: 2, trash: 1 })
    })

    it('returns all-zero counts for an owner with no files', async () => {
      expect(await counts().execute({ ownerId: OWNER })).toEqual({ all: 0, starred: 0, recent: 0, shared: 0, trash: 0 })
    })
  })

  describe('DrizzleShareData', () => {
    it('returns the public link plus the resolved share list', async () => {
      await insertFile({ id: 'f-sd-1', publicToken: 'tok-sd-1', ownerId: OWNER })
      await insertShare('sh-sd-1', 'f-sd-1', 'u-file-3', 'viewer')
      await insertShare('sh-sd-2', 'f-sd-1', 'u-file-4', 'editor')

      const data = await new DrizzleShareData(db, namesAll).execute({ id: 'f-sd-1' })
      expect(data.publicLink).toBe('/api/files/public/tok-sd-1')
      expect(data.publicEnabled).toBe(true)
      const byId = new Map(data.sharedWith.map((s) => [s.id, s]))
      expect(byId.get('u-file-3')).toMatchObject({ name: 'User u-file-3', email: 'u-file-3@x.test', access: 'viewer' })
      expect(byId.get('u-file-4')).toMatchObject({ access: 'editor' })
      expect(data.sharedWith).toHaveLength(2)
    })

    it('reports a private file (no public token) with its shares still listed', async () => {
      await insertFile({ id: 'f-sd-2', publicToken: null, ownerId: OWNER })
      await insertShare('sh-sd-3', 'f-sd-2', 'u-file-3', 'viewer')

      const data = await new DrizzleShareData(db, namesAll).execute({ id: 'f-sd-2' })
      expect(data.publicLink).toBeNull()
      expect(data.publicEnabled).toBe(false)
      expect(data.sharedWith.map((s) => s.id)).toEqual(['u-file-3'])
    })

    it('omits a share whose user does not resolve in the directory', async () => {
      await insertFile({ id: 'f-sd-3', publicToken: null, ownerId: OWNER })
      await insertShare('sh-sd-4', 'f-sd-3', 'u-file-3', 'viewer')
      await insertShare('sh-sd-5', 'f-sd-3', 'u-file-4', 'viewer')

      const data = await new DrizzleShareData(db, namesSkipping('u-file-4')).execute({ id: 'f-sd-3' })
      expect(data.sharedWith.map((s) => s.id)).toEqual(['u-file-3'])
    })

    it('returns the empty shape when the file does not exist', async () => {
      const data = await new DrizzleShareData(db, namesAll).execute({ id: 'missing' })
      expect(data).toEqual({ publicLink: null, publicEnabled: false, sharedWith: [] })
    })
  })

  describe('GrantFileAccessService (real persistence)', () => {
    const sharesFor = (fileId: string) =>
      db.select().from(schema.fileShares).where(eq(schema.fileShares.fileId, fileId))

    it('persists a share row per file x user pair', async () => {
      await insertFile({ id: 'f-grant-1', ownerId: OWNER })
      const repo = new DrizzleFileShareRepository(db)
      const publisher = new NoopPublisher()
      const service = new GrantFileAccessService(repo, publisher, fixedClock(NOW))

      await service.execute({ fileIds: ['f-grant-1'], userIds: ['u-file-3', 'u-file-4'], access: 'editor' })

      const rows = await sharesFor('f-grant-1')
      expect(rows).toHaveLength(2)
      expect(rows.every((r) => r.access === 'editor')).toBe(true)
      expect(new Set(rows.map((r) => r.userId))).toEqual(new Set(['u-file-3', 'u-file-4']))
      expect(publisher.publishCalls).toBe(1)
    })

    it('is idempotent: a re-grant at the same access writes no new rows and does not publish', async () => {
      await insertFile({ id: 'f-grant-2', ownerId: OWNER })
      const publisher = new NoopPublisher()
      const service = new GrantFileAccessService(new DrizzleFileShareRepository(db), publisher, fixedClock(NOW))

      await service.execute({ fileIds: ['f-grant-2'], userIds: ['u-file-3'], access: 'viewer' })
      await service.execute({ fileIds: ['f-grant-2'], userIds: ['u-file-3'], access: 'viewer' })

      const rows = await sharesFor('f-grant-2')
      expect(rows).toHaveLength(1)
      expect(publisher.publishCalls).toBe(1) // only the first run published
    })

    it('upgrades the existing grant in place when the access differs', async () => {
      await insertFile({ id: 'f-grant-3', ownerId: OWNER })
      const service = new GrantFileAccessService(new DrizzleFileShareRepository(db), new NoopPublisher(), fixedClock(NOW))

      await service.execute({ fileIds: ['f-grant-3'], userIds: ['u-file-3'], access: 'viewer' })
      await service.execute({ fileIds: ['f-grant-3'], userIds: ['u-file-3'], access: 'editor' })

      const rows = await sharesFor('f-grant-3')
      expect(rows).toHaveLength(1)
      expect(rows[0]!.access).toBe('editor')
    })
  })
})
