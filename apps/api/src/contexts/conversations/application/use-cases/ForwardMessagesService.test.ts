import { describe, it, expect } from 'vitest'
import { ForwardMessagesService } from '@/contexts/conversations/application/use-cases/ForwardMessagesService'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { AuthorDirectory } from '@/contexts/conversations/application/ports/out/AuthorDirectory'
import { Message } from '@/contexts/conversations/domain/Message'
import { MessageId, ConversationId } from '@/contexts/conversations/domain/ids'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { readAttachments } from '@/contexts/conversations/domain/MessageMetadata'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

const mkMessage = (id: string, conversationId: string, content: string, authorId: string | null): Message =>
  Message.rehydrate({
    id: MessageId.of(id),
    conversationId,
    authorId,
    agentId: null,
    content,
    role: 'user',
    metadata: null,
    pinned: false,
    starred: false,
    deletedAt: null,
    deletedFor: [],
    reactions: [],
    audio: null,
    createdAt: NOW,
  })

class FakeMessageRepo implements MessageRepository {
  private seq = 0
  readonly savedMany: Message[][] = []
  constructor(private store: Map<string, Message>) {}
  nextId(): MessageId {
    this.seq += 1
    return MessageId.of(`copy-${this.seq}`)
  }
  async findById(id: MessageId): Promise<Message | null> {
    return this.store.get(id.value) ?? null
  }
  async save(): Promise<void> {}
  async saveMany(messages: readonly Message[]): Promise<void> {
    this.savedMany.push([...messages])
  }
}

// membership[conversationId] = list of member userIds
class FakeMemberRepo implements ConversationMemberRepository {
  constructor(private membership: Record<string, string[]>) {}
  async findMember(conversationId: ConversationId, userId: string): Promise<ConversationMember | null> {
    const ids = this.membership[conversationId.value] ?? []
    return ids.includes(userId) ? ConversationMember.create(userId, NOW) : null
  }
  async listMemberIds(conversationId: ConversationId): Promise<string[]> {
    return [...(this.membership[conversationId.value] ?? [])]
  }
  async add(): Promise<void> {}
  async save(): Promise<void> {}
}

class FakeAuthorDirectory implements AuthorDirectory {
  constructor(private names: Map<string, string>) {}
  async displayName(authorId: string | null): Promise<string | null> {
    return authorId ? (this.names.get(authorId) ?? null) : null
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

describe('ForwardMessagesService', () => {
  it('forwards into a recipient conversation, stamping each copy with the resolved author name', async () => {
    const store = new Map<string, Message>([['m1', mkMessage('m1', 'src', 'hello there', 'author-1')]])
    const messages = new FakeMessageRepo(store)
    const members = new FakeMemberRepo({ src: ['actor', 'author-1'], dest: ['actor', 'bob'] })
    const authors = new FakeAuthorDirectory(new Map([['author-1', 'Alice']]))
    const events = new RecordingPublisher()
    const service = new ForwardMessagesService(messages, members, authors, events, fixedClock(NOW))

    const res = await service.execute({
      actorId: 'actor',
      messageIds: ['m1'],
      recipientConversationIds: ['dest'],
    })
    expect(res.ok).toBe(true)
    expect(messages.savedMany).toHaveLength(1)
    const copy = messages.savedMany[0][0]
    expect(copy.content).toBe('hello there')
    expect(copy.conversationId).toBe('dest')
    expect(copy.authorId).toBe('actor')
    const meta = copy.metadata as { forwardedFrom?: { messageId: string; authorName: string } }
    expect(meta.forwardedFrom).toEqual({ messageId: 'm1', authorName: 'Alice' })
    expect(events.events.map((e) => e.name)).toContain('conversations.MessagePosted')
  })

  it('falls back to "Unknown" when the author name does not resolve', async () => {
    const store = new Map<string, Message>([['m1', mkMessage('m1', 'src', 'hi', 'ghost')]])
    const messages = new FakeMessageRepo(store)
    const members = new FakeMemberRepo({ src: ['actor'], dest: ['actor'] })
    const authors = new FakeAuthorDirectory(new Map())
    const service = new ForwardMessagesService(messages, members, authors, new RecordingPublisher(), fixedClock(NOW))

    await service.execute({ actorId: 'actor', messageIds: ['m1'], recipientConversationIds: ['dest'] })
    const meta = messages.savedMany[0][0].metadata as { forwardedFrom?: { authorName: string } }
    expect(meta.forwardedFrom?.authorName).toBe('Unknown')
  })

  it('blocks forwarding a message from a source conversation the actor is not a member of (anti-IDOR)', async () => {
    const store = new Map<string, Message>([['m1', mkMessage('m1', 'src', 'secret', 'author-1')]])
    const messages = new FakeMessageRepo(store)
    const members = new FakeMemberRepo({ src: ['author-1'], dest: ['actor'] })
    const authors = new FakeAuthorDirectory(new Map([['author-1', 'Alice']]))
    const service = new ForwardMessagesService(messages, members, authors, new RecordingPublisher(), fixedClock(NOW))

    const res = await service.execute({ actorId: 'actor', messageIds: ['m1'], recipientConversationIds: ['dest'] })
    expect(res.ok).toBe(false)
    expect(messages.savedMany).toHaveLength(0)
  })

  it('blocks forwarding into a recipient conversation the actor is not a member of', async () => {
    const store = new Map<string, Message>([['m1', mkMessage('m1', 'src', 'hi', 'author-1')]])
    const messages = new FakeMessageRepo(store)
    const members = new FakeMemberRepo({ src: ['actor', 'author-1'], dest: ['someone-else'] })
    const authors = new FakeAuthorDirectory(new Map([['author-1', 'Alice']]))
    const service = new ForwardMessagesService(messages, members, authors, new RecordingPublisher(), fixedClock(NOW))

    const res = await service.execute({ actorId: 'actor', messageIds: ['m1'], recipientConversationIds: ['dest'] })
    expect(res.ok).toBe(false)
    expect(messages.savedMany).toHaveLength(0)
  })

  it('skips message ids that do not resolve', async () => {
    const store = new Map<string, Message>()
    const messages = new FakeMessageRepo(store)
    const members = new FakeMemberRepo({ dest: ['actor'] })
    const authors = new FakeAuthorDirectory(new Map())
    const service = new ForwardMessagesService(messages, members, authors, new RecordingPublisher(), fixedClock(NOW))

    const res = await service.execute({ actorId: 'actor', messageIds: ['missing'], recipientConversationIds: ['dest'] })
    expect(res.ok).toBe(true)
    // No originals collected => one saveMany call with zero copies.
    expect(messages.savedMany[0]).toEqual([])
  })

  it('recipientIds on the forwarded copies exclude the actor (forwardedFrom metadata carries no attachments)', async () => {
    const store = new Map<string, Message>([['m1', mkMessage('m1', 'src', 'hi', 'author-1')]])
    const messages = new FakeMessageRepo(store)
    const members = new FakeMemberRepo({ src: ['actor', 'author-1'], dest: ['actor', 'bob', 'carol'] })
    const authors = new FakeAuthorDirectory(new Map([['author-1', 'Alice']]))
    const service = new ForwardMessagesService(messages, members, authors, new RecordingPublisher(), fixedClock(NOW))

    await service.execute({ actorId: 'actor', messageIds: ['m1'], recipientConversationIds: ['dest'] })
    const copy = messages.savedMany[0][0]
    expect(readAttachments(copy.metadata)).toEqual([])
  })
})
