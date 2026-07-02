import { randomUUID } from 'node:crypto'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'

import { DrizzleConversationRepository } from '@/contexts/conversations/adapters/out/persistence/DrizzleConversationRepository'
import { DrizzleMessageRepository } from '@/contexts/conversations/adapters/out/persistence/DrizzleMessageRepository'
import { DrizzleConversationMemberRepository } from '@/contexts/conversations/adapters/out/persistence/DrizzleConversationMemberRepository'
import { DrizzleGetConversation } from '@/contexts/conversations/adapters/out/persistence/DrizzleGetConversation'
import { DrizzleGetConversationAgent } from '@/contexts/conversations/adapters/out/persistence/DrizzleGetConversationAgent'
import { DrizzleManageSession } from '@/contexts/conversations/adapters/out/persistence/DrizzleManageSession'
import { DrizzleListConversations } from '@/contexts/conversations/adapters/out/persistence/DrizzleListConversations'
import { DrizzleListMessages } from '@/contexts/conversations/adapters/out/persistence/DrizzleListMessages'

import { Conversation } from '@/contexts/conversations/domain/Conversation'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { Message } from '@/contexts/conversations/domain/Message'
import { ConversationId, MessageId } from '@/contexts/conversations/domain/ids'
import { ConversationType } from '@/contexts/conversations/domain/ConversationType'
import { MessageRole } from '@/contexts/conversations/domain/MessageRole'
import { NameResolver } from '@/contexts/conversations/application/ports/out/NameResolver'

// ADAPTER INTEGRATION tests (real Postgres) for the conversations context's
// Drizzle out-adapters. All suites live in one file: within-file tests run
// sequentially, so the shared DB stays clean between cases.
describeIntegration('conversations persistence', () => {
  let db: Database
  beforeAll(() => {
    db = getTestDb()
  })

  // SCOPED truncate (never the global resetDb): only this context's tables, so a
  // full parallel suite run never races the files/email int files.
  beforeEach(async () => {
    await db.execute(
      sql.raw('TRUNCATE conversations, conversation_members, messages, agents RESTART IDENTITY CASCADE'),
    )
  })

  // --- Seed helpers. Real inserts in FK order; users seeded idempotently and
  // never truncated, so they never touch other contexts' rows. ---
  async function seedUser(id: string): Promise<void> {
    await db
      .insert(schema.users)
      .values({ id, name: id, email: `${id}@x.test` })
      .onConflictDoNothing()
  }

  async function seedConversation(v: {
    id?: string
    type: ConversationType
    name?: string | null
    agentId?: string | null
    sessionId?: string | null
    createdAt?: Date
    updatedAt?: Date
  }): Promise<string> {
    const id = v.id ?? randomUUID()
    await db.insert(schema.conversations).values({
      id,
      type: v.type,
      name: v.name ?? null,
      agentId: v.agentId ?? null,
      sessionId: v.sessionId ?? null,
      createdAt: v.createdAt ?? new Date(),
      updatedAt: v.updatedAt ?? v.createdAt ?? new Date(),
    })
    return id
  }

  async function seedMember(
    conversationId: string,
    userId: string,
    lastReadAt: Date,
    flags?: { pinned?: number; favorite?: number; muted?: number; joinedAt?: Date },
  ): Promise<void> {
    await db.insert(schema.conversationMembers).values({
      conversationId,
      userId,
      joinedAt: flags?.joinedAt ?? lastReadAt,
      lastReadAt,
      pinned: flags?.pinned ?? 0,
      favorite: flags?.favorite ?? 0,
      muted: flags?.muted ?? 0,
    })
  }

  async function seedMessage(v: {
    id: string
    conversationId: string
    authorId?: string | null
    agentId?: string | null
    content: string
    role?: MessageRole
    createdAt: Date
    deletedAt?: Date | null
    deletedFor?: string | null
  }): Promise<void> {
    await db.insert(schema.messages).values({
      id: v.id,
      conversationId: v.conversationId,
      authorId: v.authorId ?? null,
      agentId: v.agentId ?? null,
      content: v.content,
      role: v.role ?? 'user',
      createdAt: v.createdAt,
      deletedAt: v.deletedAt ?? null,
      deletedFor: v.deletedFor ?? null,
    })
  }

  // Fake NameResolver out-port (ACL). Matches the port: userNames/agentNames both
  // take string[] and return Map<string,string>.
  const names: NameResolver = {
    userNames: async (ids: string[]) => new Map(ids.map((i) => [i, 'User ' + i])),
    agentNames: async () => new Map(),
  }

  // -------------------------------------------------------------------------
  describe('DrizzleConversationRepository', () => {
    it('save then findById round-trips scalar state', async () => {
      const repo = new DrizzleConversationRepository(db)
      const id = repo.nextId()
      const now = new Date('2026-02-01T00:00:00.000Z')
      await repo.save(
        Conversation.rehydrate({
          id,
          name: 'Planning',
          type: 'channel',
          agentId: 'a-1',
          sessionId: 'sess-1',
          members: [],
          createdAt: now,
          updatedAt: now,
        }),
      )

      const loaded = await repo.findById(id)
      expect(loaded).not.toBeNull()
      expect(loaded!.id.value).toBe(id.value)
      expect(loaded!.name).toBe('Planning')
      expect(loaded!.type).toBe('channel')
      expect(loaded!.agentId).toBe('a-1')
      expect(loaded!.sessionId).toBe('sess-1')
    })

    it('findById returns null for an unknown id', async () => {
      const repo = new DrizzleConversationRepository(db)
      expect(await repo.findById(ConversationId.of('missing'))).toBeNull()
    })

    it('exists reflects presence', async () => {
      const repo = new DrizzleConversationRepository(db)
      const id = repo.nextId()
      expect(await repo.exists(id)).toBe(false)
      await repo.save(Conversation.createDm({ id, userA: 'x', userB: 'y', now: new Date() }))
      expect(await repo.exists(id)).toBe(true)
    })

    it('save upserts an existing row (onConflictDoUpdate)', async () => {
      const repo = new DrizzleConversationRepository(db)
      const id = repo.nextId()
      const t0 = new Date('2026-02-01T00:00:00.000Z')
      await repo.save(
        Conversation.rehydrate({ id, name: 'Old', type: 'channel', agentId: null, sessionId: null, members: [], createdAt: t0, updatedAt: t0 }),
      )
      await repo.save(
        Conversation.rehydrate({ id, name: 'New', type: 'channel', agentId: 'a-2', sessionId: null, members: [], createdAt: t0, updatedAt: new Date('2026-02-02T00:00:00.000Z') }),
      )
      const loaded = await repo.findById(id)
      expect(loaded!.name).toBe('New')
      expect(loaded!.agentId).toBe('a-2')
    })

    it('saveIfAbsent does not overwrite an existing row', async () => {
      const repo = new DrizzleConversationRepository(db)
      const id = repo.nextId()
      const t0 = new Date('2026-02-01T00:00:00.000Z')
      await repo.save(
        Conversation.rehydrate({ id, name: 'First', type: 'channel', agentId: null, sessionId: null, members: [], createdAt: t0, updatedAt: t0 }),
      )
      await repo.saveIfAbsent(
        Conversation.rehydrate({ id, name: 'Second', type: 'channel', agentId: null, sessionId: null, members: [], createdAt: t0, updatedAt: t0 }),
      )
      const loaded = await repo.findById(id)
      expect(loaded!.name).toBe('First')
    })

    it('delete removes the row', async () => {
      const repo = new DrizzleConversationRepository(db)
      const id = repo.nextId()
      await repo.save(Conversation.createDm({ id, userA: 'x', userB: 'y', now: new Date() }))
      await repo.delete(id)
      expect(await repo.findById(id)).toBeNull()
    })

    it('findDmBetween finds the dm both users belong to (order-independent)', async () => {
      await seedUser('u-conv-1')
      await seedUser('u-conv-2')
      const repo = new DrizzleConversationRepository(db)
      const id = repo.nextId()
      const now = new Date('2026-02-10T00:00:00.000Z')
      await repo.save(Conversation.createDm({ id, userA: 'u-conv-1', userB: 'u-conv-2', now }))
      await seedMember(id.value, 'u-conv-1', now)
      await seedMember(id.value, 'u-conv-2', now)

      expect((await repo.findDmBetween('u-conv-1', 'u-conv-2'))?.value).toBe(id.value)
      expect((await repo.findDmBetween('u-conv-2', 'u-conv-1'))?.value).toBe(id.value)
      expect(await repo.findDmBetween('u-conv-1', 'u-conv-9')).toBeNull()
    })

    it('findEricConversation finds the user ai conversation bound to the agent', async () => {
      await seedUser('u-conv-1')
      const repo = new DrizzleConversationRepository(db)
      const id = repo.nextId()
      const now = new Date('2026-02-11T00:00:00.000Z')
      await repo.save(Conversation.createEric({ id, agentId: 'a-eric', userId: 'u-conv-1', now }))
      await seedMember(id.value, 'u-conv-1', now)

      expect((await repo.findEricConversation('a-eric', 'u-conv-1'))?.value).toBe(id.value)
      expect(await repo.findEricConversation('a-other', 'u-conv-1')).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  describe('DrizzleConversationMemberRepository', () => {
    it('add then listMemberIds and findMember round-trip', async () => {
      await seedUser('u-conv-1')
      await seedUser('u-conv-2')
      const convId = await seedConversation({ type: 'channel' })
      const repo = new DrizzleConversationMemberRepository(db)
      const now = new Date('2026-03-01T00:00:00.000Z')

      await repo.add(ConversationId.of(convId), [
        ConversationMember.create('u-conv-1', now),
        ConversationMember.create('u-conv-2', now),
      ])

      const ids = await repo.listMemberIds(ConversationId.of(convId))
      expect([...ids].sort()).toEqual(['u-conv-1', 'u-conv-2'])

      const found = await repo.findMember(ConversationId.of(convId), 'u-conv-1')
      expect(found).not.toBeNull()
      expect(found!.userId).toBe('u-conv-1')
      expect(found!.pinned).toBe(false)
      expect(found!.favorite).toBe(false)
      expect(found!.muted).toBe(false)
    })

    it('add is idempotent (onConflictDoNothing)', async () => {
      await seedUser('u-conv-1')
      const convId = await seedConversation({ type: 'channel' })
      const repo = new DrizzleConversationMemberRepository(db)
      const m = ConversationMember.create('u-conv-1', new Date('2026-03-01T00:00:00.000Z'))
      await repo.add(ConversationId.of(convId), [m])
      await repo.add(ConversationId.of(convId), [m])
      expect((await repo.listMemberIds(ConversationId.of(convId))).length).toBe(1)
    })

    it('save upserts the read cursor and personal flags', async () => {
      await seedUser('u-conv-1')
      const convId = await seedConversation({ type: 'channel' })
      const repo = new DrizzleConversationMemberRepository(db)
      const joinedAt = new Date('2026-03-01T00:00:00.000Z')
      const member = ConversationMember.create('u-conv-1', joinedAt)
      await repo.add(ConversationId.of(convId), [member])

      member.togglePinned()
      member.toggleMuted()
      const readAt = new Date('2026-03-05T12:00:00.000Z')
      member.markRead(readAt)
      await repo.save(ConversationId.of(convId), member)

      const found = await repo.findMember(ConversationId.of(convId), 'u-conv-1')
      expect(found!.pinned).toBe(true)
      expect(found!.muted).toBe(true)
      expect(found!.favorite).toBe(false)
      expect(found!.lastReadAt.toISOString()).toBe(readAt.toISOString())
    })

    it('findMember returns null for a non-member', async () => {
      const convId = await seedConversation({ type: 'channel' })
      const repo = new DrizzleConversationMemberRepository(db)
      expect(await repo.findMember(ConversationId.of(convId), 'nobody')).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  describe('DrizzleMessageRepository', () => {
    const buildMessage = (over: {
      id: MessageId
      conversationId: string
      authorId?: string | null
      agentId?: string | null
      content?: string
      role?: MessageRole
      metadata?: Record<string, unknown> | null
      pinned?: boolean
      starred?: boolean
      deletedFor?: string[]
      reactions?: { emoji: string; userId: string }[]
      createdAt?: Date
    }): Message =>
      Message.rehydrate({
        id: over.id,
        conversationId: over.conversationId,
        authorId: over.authorId ?? null,
        agentId: over.agentId ?? null,
        content: over.content ?? 'hello',
        role: over.role ?? 'user',
        metadata: (over.metadata ?? null) as never,
        pinned: over.pinned ?? false,
        starred: over.starred ?? false,
        deletedAt: null,
        deletedFor: over.deletedFor ?? [],
        reactions: over.reactions ?? [],
        audio: null,
        createdAt: over.createdAt ?? new Date('2026-04-01T00:00:00.000Z'),
      })

    it('save then findById round-trips the message (json columns included)', async () => {
      await seedUser('u-conv-1')
      const convId = await seedConversation({ type: 'channel' })
      const repo = new DrizzleMessageRepository(db)
      const id = repo.nextId()
      const msg = buildMessage({
        id,
        conversationId: convId,
        authorId: 'u-conv-1',
        content: 'hello world',
        metadata: { replyTo: 'x' },
        pinned: true,
        deletedFor: ['u-conv-2'],
        reactions: [{ emoji: '👍', userId: 'u-conv-1' }],
      })
      await repo.save(msg)

      const loaded = await repo.findById(id)
      expect(loaded).not.toBeNull()
      expect(loaded!.content).toBe('hello world')
      expect(loaded!.authorId).toBe('u-conv-1')
      expect(loaded!.role).toBe('user')
      expect(loaded!.pinned).toBe(true)
      expect(loaded!.metadata).toEqual({ replyTo: 'x' })
      expect([...loaded!.deletedFor]).toEqual(['u-conv-2'])
      expect([...loaded!.reactions]).toEqual([{ emoji: '👍', userId: 'u-conv-1' }])
    })

    it('save upserts mutable columns', async () => {
      await seedUser('u-conv-1')
      const convId = await seedConversation({ type: 'channel' })
      const repo = new DrizzleMessageRepository(db)
      const id = repo.nextId()
      await repo.save(buildMessage({ id, conversationId: convId, authorId: 'u-conv-1', content: 'v1', pinned: false }))
      await repo.save(buildMessage({ id, conversationId: convId, authorId: 'u-conv-1', content: 'v2', pinned: true }))
      const loaded = await repo.findById(id)
      expect(loaded!.content).toBe('v2')
      expect(loaded!.pinned).toBe(true)
    })

    it('saveMany inserts a batch', async () => {
      await seedUser('u-conv-1')
      const convId = await seedConversation({ type: 'channel' })
      const repo = new DrizzleMessageRepository(db)
      const a = repo.nextId()
      const b = repo.nextId()
      await repo.saveMany([
        buildMessage({ id: a, conversationId: convId, authorId: 'u-conv-1', content: 'a' }),
        buildMessage({ id: b, conversationId: convId, authorId: 'u-conv-1', content: 'b' }),
      ])
      expect((await repo.findById(a))!.content).toBe('a')
      expect((await repo.findById(b))!.content).toBe('b')
    })

    it('saveMany with an empty list is a no-op', async () => {
      const repo = new DrizzleMessageRepository(db)
      await expect(repo.saveMany([])).resolves.toBeUndefined()
    })

    it('findById returns null for an unknown id', async () => {
      const repo = new DrizzleMessageRepository(db)
      expect(await repo.findById(MessageId.of('nope'))).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  describe('DrizzleGetConversation', () => {
    it('returns the conversation view for a member', async () => {
      await seedUser('u-conv-1')
      const now = new Date('2026-05-01T00:00:00.000Z')
      const convId = await seedConversation({ type: 'ai', name: 'Eric', agentId: 'a-1', sessionId: 's-1', createdAt: now, updatedAt: now })
      await seedMember(convId, 'u-conv-1', now)

      const res = await new DrizzleGetConversation(db).execute({ id: convId, userId: 'u-conv-1' })
      expect(res).not.toBeNull()
      expect(res!.id).toBe(convId)
      expect(res!.name).toBe('Eric')
      expect(res!.type).toBe('ai')
      expect(res!.agentId).toBe('a-1')
      expect(res!.sessionId).toBe('s-1')
    })

    it('returns null for a non-member', async () => {
      await seedUser('u-conv-1')
      const convId = await seedConversation({ type: 'channel' })
      // No membership row for u-conv-1.
      expect(await new DrizzleGetConversation(db).execute({ id: convId, userId: 'u-conv-1' })).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  describe('DrizzleGetConversationAgent', () => {
    it('returns the bound agentId', async () => {
      const convId = await seedConversation({ type: 'ai', agentId: 'a-99' })
      expect(await new DrizzleGetConversationAgent(db).execute(convId)).toBe('a-99')
    })

    it('returns null when no agent is bound', async () => {
      const convId = await seedConversation({ type: 'channel', agentId: null })
      expect(await new DrizzleGetConversationAgent(db).execute(convId)).toBeNull()
    })

    it('returns null for an unknown conversation', async () => {
      expect(await new DrizzleGetConversationAgent(db).execute('missing')).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  describe('DrizzleManageSession', () => {
    it('getSessionId returns null initially, then the value after a set', async () => {
      const convId = await seedConversation({ type: 'ai', sessionId: null })
      const mgr = new DrizzleManageSession(db)
      expect(await mgr.getSessionId(convId)).toBeNull()
      const written = await mgr.saveSessionId({ conversationId: convId, sessionId: 'sess-1', expectedPrevious: null })
      expect(written).toBe(true)
      expect(await mgr.getSessionId(convId)).toBe('sess-1')
    })

    it('CAS no-ops (returns false) when expectedPrevious does NOT match', async () => {
      const convId = await seedConversation({ type: 'ai', sessionId: 'sess-1' })
      const mgr = new DrizzleManageSession(db)
      const written = await mgr.saveSessionId({ conversationId: convId, sessionId: 'sess-2', expectedPrevious: 'WRONG' })
      expect(written).toBe(false)
      expect(await mgr.getSessionId(convId)).toBe('sess-1') // unchanged
    })

    it('CAS succeeds when expectedPrevious matches the current session', async () => {
      const convId = await seedConversation({ type: 'ai', sessionId: 'sess-1' })
      const mgr = new DrizzleManageSession(db)
      const written = await mgr.saveSessionId({ conversationId: convId, sessionId: 'sess-2', expectedPrevious: 'sess-1' })
      expect(written).toBe(true)
      expect(await mgr.getSessionId(convId)).toBe('sess-2')
    })

    it('CAS with expectedPrevious=null fails when a session is already set', async () => {
      const convId = await seedConversation({ type: 'ai', sessionId: 'sess-1' })
      const mgr = new DrizzleManageSession(db)
      const written = await mgr.saveSessionId({ conversationId: convId, sessionId: 'sess-2', expectedPrevious: null })
      expect(written).toBe(false)
      expect(await mgr.getSessionId(convId)).toBe('sess-1')
    })

    it('clearSessionId resets the session to null', async () => {
      const convId = await seedConversation({ type: 'ai', sessionId: 'sess-1' })
      const mgr = new DrizzleManageSession(db)
      await mgr.clearSessionId(convId)
      expect(await mgr.getSessionId(convId)).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  describe('DrizzleListConversations', () => {
    it('lists with unread counts, last-message preview, resolved names, flags and ordering', async () => {
      await seedUser('u-conv-1')
      await seedUser('u-conv-2')
      const lastRead = new Date('2026-01-01T00:00:00.000Z')

      // DM: caller pinned; peer authored two messages after lastRead, caller one.
      await seedConversation({ id: 'c-dm', type: 'dm', name: null, createdAt: lastRead, updatedAt: lastRead })
      await seedMember('c-dm', 'u-conv-1', lastRead, { pinned: 1 })
      await seedMember('c-dm', 'u-conv-2', lastRead)
      await seedMessage({ id: 'm1', conversationId: 'c-dm', authorId: 'u-conv-2', content: 'hi from peer', createdAt: new Date('2026-01-02T00:00:00.000Z') })
      await seedMessage({ id: 'm2', conversationId: 'c-dm', authorId: 'u-conv-1', content: 'my reply', createdAt: new Date('2026-01-03T00:00:00.000Z') })
      await seedMessage({ id: 'm3', conversationId: 'c-dm', authorId: 'u-conv-2', content: 'latest from peer', createdAt: new Date('2026-01-04T00:00:00.000Z') })

      // Channel: no messages, older createdAt so the dm sorts first.
      await seedConversation({ id: 'c-ch', type: 'channel', name: 'General', createdAt: new Date('2025-12-01T00:00:00.000Z'), updatedAt: new Date('2025-12-01T00:00:00.000Z') })
      await seedMember('c-ch', 'u-conv-1', lastRead)

      const list = await new DrizzleListConversations(db, names).execute({ userId: 'u-conv-1' })
      expect(list.map((r) => r.id)).toEqual(['c-dm', 'c-ch'])

      const dm = list.find((r) => r.id === 'c-dm')!
      expect(dm.type).toBe('dm')
      expect(dm.name).toBe('User u-conv-2') // DM peer resolved through the NameResolver
      expect(dm.lastMessage).toBe('latest from peer')
      // lastMessageAt is now formatted as an explicit ISO-8601 UTC string in SQL
      // (to_char ... "Z"), so it is timezone-stable on any host (the prior raw
      // max() shifted it into the process tz). The day must be the UTC day.
      expect(dm.lastMessageAt.startsWith('2026-01-04')).toBe(true)
      expect(dm.lastMessageAt.endsWith('Z')).toBe(true)
      expect(dm.unreadCount).toBe(2) // m1 + m3 (peer, after lastRead); m2 excluded (caller-authored)
      expect(dm.pinned).toBe(true)
      expect(dm.favorite).toBe(false)
      expect(dm.muted).toBe(false)

      const ch = list.find((r) => r.id === 'c-ch')!
      expect(ch.name).toBe('General')
      expect(ch.lastMessage).toBe('')
      expect(ch.unreadCount).toBe(0)
      expect(ch.lastMessageAt).toBe(new Date('2025-12-01T00:00:00.000Z').toISOString())
    })

    it('returns an empty list for a user with no memberships', async () => {
      await seedUser('u-conv-1')
      expect(await new DrizzleListConversations(db, names).execute({ userId: 'u-conv-1' })).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  describe('DrizzleListMessages', () => {
    it('membership guard: a non-member reads nothing', async () => {
      const convId = await seedConversation({ type: 'channel' })
      const res = await new DrizzleListMessages(db, names).execute({ conversationId: convId, userId: 'nobody', limit: 10 })
      expect(res).toEqual({ items: [], nextCursor: undefined })
    })

    it('returns visible messages newest-first with resolved author names', async () => {
      await seedUser('u-conv-1')
      const convId = await seedConversation({ type: 'channel' })
      await seedMember(convId, 'u-conv-1', new Date('2026-01-01T00:00:00.000Z'))
      await seedMessage({ id: 'm1', conversationId: convId, authorId: 'u-conv-1', content: 'first', role: 'user', createdAt: new Date('2026-01-01T00:00:00.000Z') })
      await seedMessage({ id: 'm2', conversationId: convId, authorId: 'u-conv-1', content: 'second', role: 'user', createdAt: new Date('2026-01-02T00:00:00.000Z') })
      await seedMessage({ id: 'm3', conversationId: convId, authorId: null, agentId: 'a-eric', content: 'from agent', role: 'ai', createdAt: new Date('2026-01-03T00:00:00.000Z') })
      // Soft-deleted for everyone -> excluded by the query.
      await seedMessage({ id: 'm4', conversationId: convId, authorId: 'u-conv-1', content: 'gone', createdAt: new Date('2026-01-04T00:00:00.000Z'), deletedAt: new Date('2026-01-04T00:00:00.000Z') })
      // Deleted-for-me by the caller -> filtered out for this user.
      await seedMessage({ id: 'm5', conversationId: convId, authorId: 'u-conv-1', content: 'hidden', createdAt: new Date('2026-01-05T00:00:00.000Z'), deletedFor: JSON.stringify(['u-conv-1']) })

      const res = await new DrizzleListMessages(db, names).execute({ conversationId: convId, userId: 'u-conv-1', limit: 50 })
      expect(res.items.map((i) => i.id)).toEqual(['m3', 'm2', 'm1']) // newest-first; m4 (soft-deleted) and m5 (deleted-for-me) excluded
      expect(res.nextCursor).toBeUndefined()

      const m1 = res.items.find((i) => i.id === 'm1')!
      expect(m1.authorName).toBe('User u-conv-1')
      expect(m1.role).toBe('user')

      const m3 = res.items.find((i) => i.id === 'm3')!
      expect(m3.agentId).toBe('a-eric')
      expect(m3.authorName).toBe('Eric') // agentNames fake is empty -> falls back to DEFAULT_AGENT_NAME
    })

    it('paginates newest-first with a cursor without dropping the boundary row', async () => {
      await seedUser('u-conv-1')
      const convId = await seedConversation({ type: 'channel' })
      await seedMember(convId, 'u-conv-1', new Date('2026-01-01T00:00:00.000Z'))
      // p1..p5 oldest..newest.
      for (let i = 1; i <= 5; i++) {
        await seedMessage({
          id: `p${i}`,
          conversationId: convId,
          authorId: 'u-conv-1',
          content: `p${i}`,
          createdAt: new Date(`2026-01-0${i}T00:00:00.000Z`),
        })
      }

      const q = new DrizzleListMessages(db, names)
      const page1 = await q.execute({ conversationId: convId, userId: 'u-conv-1', limit: 2 })
      expect(page1.items.map((i) => i.id)).toEqual(['p5', 'p4'])
      // nextCursor is the LAST KEPT item (p4), so the next page resumes at the boundary.
      expect(page1.nextCursor).toBe(new Date('2026-01-04T00:00:00.000Z').toISOString())

      const page2 = await q.execute({ conversationId: convId, userId: 'u-conv-1', limit: 2, cursor: page1.nextCursor })
      // p3 (the boundary) is no longer skipped.
      expect(page2.items.map((i) => i.id)).toEqual(['p3', 'p2'])
      expect(page2.nextCursor).toBe(new Date('2026-01-02T00:00:00.000Z').toISOString())

      const page3 = await q.execute({ conversationId: convId, userId: 'u-conv-1', limit: 2, cursor: page2.nextCursor })
      expect(page3.items.map((i) => i.id)).toEqual(['p1'])
      expect(page3.nextCursor).toBeUndefined()
    })
  })
})
