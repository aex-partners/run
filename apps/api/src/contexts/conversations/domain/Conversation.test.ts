import { describe, it, expect } from 'vitest'
import { Conversation } from '@/contexts/conversations/domain/Conversation'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { ConversationId } from '@/contexts/conversations/domain/ids'

const NOW = new Date('2026-01-01T00:00:00Z')
const LATER = new Date('2026-01-02T00:00:00Z')
const cid = (v: string) => ConversationId.of(v)

describe('Conversation.create', () => {
  it('seeds the creator as first member and appends distinct extra members', () => {
    const conv = Conversation.create({
      id: cid('c1'),
      name: 'Team',
      type: 'channel',
      creatorId: 'u1',
      memberIds: ['u2', 'u3'],
      now: NOW,
    })
    expect(conv.memberIds()).toEqual(['u1', 'u2', 'u3'])
    expect(conv.name).toBe('Team')
    expect(conv.type).toBe('channel')
    expect(conv.agentId).toBeNull()
    expect(conv.sessionId).toBeNull()
    expect(conv.createdAt).toBe(NOW)
    expect(conv.updatedAt).toBe(NOW)
  })

  it('dedups the creator and repeated ids in memberIds', () => {
    const conv = Conversation.create({
      id: cid('c1'),
      name: null,
      type: 'channel',
      creatorId: 'u1',
      memberIds: ['u1', 'u2', 'u2', 'u1'],
      now: NOW,
    })
    expect(conv.memberIds()).toEqual(['u1', 'u2'])
  })

  it('records a ConversationCreated event with a null agent', () => {
    const conv = Conversation.create({
      id: cid('c1'),
      name: 'Team',
      type: 'channel',
      creatorId: 'u1',
      memberIds: [],
      now: NOW,
    })
    const events = conv.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('conversations.ConversationCreated')
    expect(events[0].aggregateId).toBe('c1')
  })
})

describe('Conversation.createDm', () => {
  it('builds a 1:1 dm with the two users and no name', () => {
    const conv = Conversation.createDm({ id: cid('dm1'), userA: 'u1', userB: 'u2', now: NOW })
    expect(conv.type).toBe('dm')
    expect(conv.name).toBeNull()
    expect(conv.memberIds()).toEqual(['u1', 'u2'])
    const events = conv.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('conversations.ConversationCreated')
  })
})

describe('Conversation.createEric', () => {
  it('builds a private ai conversation bound to the agent for one user', () => {
    const conv = Conversation.createEric({ id: cid('e1'), agentId: 'agent-eric', userId: 'u1', now: NOW })
    expect(conv.type).toBe('ai')
    expect(conv.name).toBe('Eric')
    expect(conv.agentId).toBe('agent-eric')
    expect(conv.memberIds()).toEqual(['u1'])
    const events = conv.pullEvents() as Array<{ name: string; agentId: string | null }>
    expect(events[0].name).toBe('conversations.ConversationCreated')
    expect(events[0].agentId).toBe('agent-eric')
  })
})

describe('Conversation.rehydrate', () => {
  it('restores all scalar fields and the membership set without recording events', () => {
    const members = [ConversationMember.create('u1', NOW), ConversationMember.create('u2', NOW)]
    const conv = Conversation.rehydrate({
      id: cid('c1'),
      name: 'Restored',
      type: 'channel',
      agentId: 'a1',
      sessionId: 's1',
      members,
      createdAt: NOW,
      updatedAt: LATER,
    })
    expect(conv.name).toBe('Restored')
    expect(conv.agentId).toBe('a1')
    expect(conv.sessionId).toBe('s1')
    expect(conv.updatedAt).toBe(LATER)
    expect(conv.memberIds()).toEqual(['u1', 'u2'])
    expect(conv.pullEvents()).toHaveLength(0)
  })
})

describe('Conversation.addMember', () => {
  it('adds a new member, bumps updatedAt and records MemberAdded', () => {
    const conv = Conversation.create({
      id: cid('c1'),
      name: 'Team',
      type: 'channel',
      creatorId: 'u1',
      memberIds: [],
      now: NOW,
    })
    conv.pullEvents() // drain the creation event
    const res = conv.addMember('u2', LATER)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).not.toBeNull()
    expect(conv.isMember('u2')).toBe(true)
    expect(conv.updatedAt).toBe(LATER)
    const events = conv.pullEvents() as Array<{ name: string; userId: string }>
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('conversations.MemberAdded')
    expect(events[0].userId).toBe('u2')
  })

  it('is idempotent: re-adding an existing member is a no-op with no event', () => {
    const conv = Conversation.create({
      id: cid('c1'),
      name: 'Team',
      type: 'channel',
      creatorId: 'u1',
      memberIds: [],
      now: NOW,
    })
    conv.pullEvents()
    const res = conv.addMember('u1', LATER)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toBeNull()
    expect(conv.memberIds()).toEqual(['u1'])
    expect(conv.pullEvents()).toHaveLength(0)
  })
})

describe('Conversation members per-member state', () => {
  it('exposes pinned/favorite/muted toggles and the read cursor per member', () => {
    const conv = Conversation.create({
      id: cid('c1'),
      name: 'Team',
      type: 'channel',
      creatorId: 'u1',
      memberIds: ['u2'],
      now: NOW,
    })
    const m = conv.member('u1')!
    expect(m.pinned).toBe(false)
    expect(m.favorite).toBe(false)
    expect(m.muted).toBe(false)
    expect(m.lastReadAt).toBe(NOW)
    expect(m.joinedAt).toBe(NOW)

    expect(m.togglePinned()).toBe(true)
    expect(m.pinned).toBe(true)
    expect(m.toggleFavorite()).toBe(true)
    expect(m.toggleMuted()).toBe(true)
    m.markRead(LATER)
    expect(m.lastReadAt).toBe(LATER)

    // Toggling one member's flags does not leak to another member.
    expect(conv.member('u2')!.pinned).toBe(false)
  })

  it('member() returns undefined for a non-member', () => {
    const conv = Conversation.createDm({ id: cid('dm1'), userA: 'u1', userB: 'u2', now: NOW })
    expect(conv.member('u9')).toBeUndefined()
    expect(conv.isMember('u9')).toBe(false)
  })
})

describe('Conversation.rename / setAgent', () => {
  it('trims and applies a non-empty name and bumps updatedAt', () => {
    const conv = Conversation.create({
      id: cid('c1'),
      name: 'Old',
      type: 'channel',
      creatorId: 'u1',
      memberIds: [],
      now: NOW,
    })
    const res = conv.rename('  New Name  ', LATER)
    expect(res.ok).toBe(true)
    expect(conv.name).toBe('New Name')
    expect(conv.updatedAt).toBe(LATER)
  })

  it('rejects a blank name', () => {
    const conv = Conversation.create({
      id: cid('c1'),
      name: 'Old',
      type: 'channel',
      creatorId: 'u1',
      memberIds: [],
      now: NOW,
    })
    const res = conv.rename('   ', LATER)
    expect(res.ok).toBe(false)
    expect(conv.name).toBe('Old')
  })

  it('setAgent updates the bound agent and updatedAt', () => {
    const conv = Conversation.create({
      id: cid('c1'),
      name: 'Team',
      type: 'channel',
      creatorId: 'u1',
      memberIds: [],
      now: NOW,
    })
    conv.setAgent('agent-x', LATER)
    expect(conv.agentId).toBe('agent-x')
    expect(conv.updatedAt).toBe(LATER)
    conv.setAgent(null, NOW)
    expect(conv.agentId).toBeNull()
  })
})
