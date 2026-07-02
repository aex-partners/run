import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleKnowledgeRepository } from '@/contexts/knowledge/adapters/out/persistence/DrizzleKnowledgeRepository'
import { Knowledge } from '@/contexts/knowledge/domain/Knowledge'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'
import { Category } from '@/contexts/knowledge/domain/Category'

const NOW = new Date('2024-01-01T00:00:00.000Z')

describeIntegration('DrizzleKnowledgeRepository (integration)', () => {
  let db: Database
  let repo: DrizzleKnowledgeRepository
  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzleKnowledgeRepository(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  async function seedFile(userId: string): Promise<string> {
    const id = `file-${randomUUID()}`
    await db.insert(schema.files).values({ id, name: 'doc.pdf', type: 'file', ownerId: userId })
    return id
  }

  function makeKnowledge(
    id: string,
    opts: { scope?: string; category?: string; title?: string; content?: string; createdBy: string | null; sourceFileId?: string | null },
  ): Knowledge {
    const r = Knowledge.create(
      KnowledgeId.of(id),
      {
        scope: opts.scope ?? 'company',
        category: opts.category ?? 'note',
        title: opts.title ?? 'Title',
        content: opts.content ?? 'Content',
        createdBy: opts.createdBy,
        sourceFileId: opts.sourceFileId ?? null,
      },
      NOW,
    )
    if (!r.ok) throw new Error(`setup failed: ${r.error}`)
    return r.value
  }

  it('round-trips a saved aggregate by id', async () => {
    const userId = await seedUser()
    const id = `k-${randomUUID()}`
    await repo.save(makeKnowledge(id, { scope: 'personal', category: 'client', title: 'Acme', content: 'big account', createdBy: userId }))

    const found = await repo.findById(KnowledgeId.of(id))
    expect(found).not.toBeNull()
    expect(found!.title).toBe('Acme')
    expect(found!.content).toBe('big account')
    expect(found!.scope.kind).toBe('personal')
    expect(found!.category.value).toBe('client')
    expect(found!.createdBy).toBe(userId)
  })

  it('returns null for a missing id', async () => {
    expect(await repo.findById(KnowledgeId.of(`missing-${randomUUID()}`))).toBeNull()
  })

  it('finds the file-content row auto-indexed from a source file', async () => {
    const userId = await seedUser()
    const fileId = await seedFile(userId)
    const id = `k-${randomUUID()}`
    await repo.save(makeKnowledge(id, { category: Category.FILE_CONTENT, createdBy: null, sourceFileId: fileId }))

    const found = await repo.findBySourceFileId(fileId)
    expect(found).not.toBeNull()
    expect(found!.id.value).toBe(id)
    expect(found!.sourceFileId).toBe(fileId)
  })

  it('lists a requester\'s personal rows and excludes file-content', async () => {
    const userId = await seedUser()
    const fileId = await seedFile(userId)
    const normalId = `k-${randomUUID()}`
    const fileContentId = `k-${randomUUID()}`
    await repo.save(makeKnowledge(normalId, { scope: 'personal', category: 'note', createdBy: userId }))
    await repo.save(makeKnowledge(fileContentId, { scope: 'personal', category: Category.FILE_CONTENT, createdBy: userId, sourceFileId: fileId }))

    const rows = await repo.list({ requesterId: userId, scope: 'personal', excludeFileContent: true, limit: 100, offset: 0 })
    const ids = rows.map((r) => r.id)
    expect(ids).toContain(normalId)
    expect(ids).not.toContain(fileContentId)
  })

  it('enforces personal-scope ACL on view', async () => {
    const owner = await seedUser()
    const other = await seedUser()
    const personalId = `k-${randomUUID()}`
    const companyId = `k-${randomUUID()}`
    await repo.save(makeKnowledge(personalId, { scope: 'personal', createdBy: owner }))
    await repo.save(makeKnowledge(companyId, { scope: 'company', createdBy: owner }))

    expect(await repo.view(KnowledgeId.of(personalId), owner)).not.toBeNull()
    expect(await repo.view(KnowledgeId.of(personalId), other)).toBeNull()
    // Company entries are visible to anyone.
    expect(await repo.view(KnowledgeId.of(companyId), other)).not.toBeNull()
  })

  it('text-searches title/content scoped to the requester', async () => {
    const userId = await seedUser()
    const token = randomUUID().replace(/-/g, '')
    const id = `k-${randomUUID()}`
    await repo.save(makeKnowledge(id, { scope: 'personal', title: `Topic ${token}`, content: 'body', createdBy: userId }))

    const rows = await repo.textSearch({ requesterId: userId, query: token, excludeFileContent: false, limit: 50 })
    expect(rows.map((r) => r.id)).toEqual([id])
  })

  it('listCategories includes real categories and never file-content', async () => {
    const userId = await seedUser()
    const cat = `cat-${randomUUID()}`
    const fileId = await seedFile(userId)
    await repo.save(makeKnowledge(`k-${randomUUID()}`, { scope: 'company', category: cat, createdBy: userId }))
    await repo.save(makeKnowledge(`k-${randomUUID()}`, { category: Category.FILE_CONTENT, createdBy: null, sourceFileId: fileId }))

    const cats = await repo.listCategories()
    expect(cats).toContain(cat)
    expect(cats).not.toContain(Category.FILE_CONTENT)
  })

  it('deletes a row by id', async () => {
    const userId = await seedUser()
    const id = `k-${randomUUID()}`
    await repo.save(makeKnowledge(id, { createdBy: userId }))

    await repo.delete(KnowledgeId.of(id))
    expect(await repo.findById(KnowledgeId.of(id))).toBeNull()
  })
})
