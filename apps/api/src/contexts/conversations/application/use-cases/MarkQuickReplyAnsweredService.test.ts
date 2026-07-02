import { describe, it, expect } from 'vitest'
import { MarkQuickReplyAnsweredService } from '@/contexts/conversations/application/use-cases/MarkQuickReplyAnsweredService'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { Message } from '@/contexts/conversations/domain/Message'
import { MessageId } from '@/contexts/conversations/domain/ids'
import { JsonObject } from '@/shared/domain/Json'

const NOW = new Date('2026-01-01T00:00:00Z')

const mkMessage = (id: string, metadata: JsonObject | null): Message =>
  Message.rehydrate({
    id: MessageId.of(id),
    conversationId: 'c1',
    authorId: 'author',
    agentId: null,
    content: 'pick one',
    role: 'ai',
    metadata,
    pinned: false,
    starred: false,
    deletedAt: null,
    deletedFor: [],
    reactions: [],
    audio: null,
    createdAt: NOW,
  })

class FakeMessageRepo implements MessageRepository {
  readonly saved: Message[] = []
  constructor(private store: Map<string, Message>) {}
  nextId(): MessageId {
    return MessageId.of('m-x')
  }
  async findById(id: MessageId): Promise<Message | null> {
    return this.store.get(id.value) ?? null
  }
  async save(message: Message): Promise<void> {
    this.saved.push(message)
  }
  async saveMany(): Promise<void> {}
}

describe('MarkQuickReplyAnsweredService', () => {
  it('flips the quick-reply block to answered and saves the message', async () => {
    const m1 = mkMessage('m1', { quickReplies: { answered: false, options: ['a', 'b'] } })
    const messages = new FakeMessageRepo(new Map([['m1', m1]]))
    const service = new MarkQuickReplyAnsweredService(messages)

    const res = await service.execute({ messageId: 'm1' })

    expect(res.ok).toBe(true)
    expect(messages.saved).toHaveLength(1)
    const qr = m1.metadata?.quickReplies as { answered: boolean }
    expect(qr.answered).toBe(true)
  })

  it('is lenient when the message is missing: success and no save', async () => {
    const messages = new FakeMessageRepo(new Map())
    const service = new MarkQuickReplyAnsweredService(messages)

    const res = await service.execute({ messageId: 'missing' })

    expect(res.ok).toBe(true)
    expect(messages.saved).toHaveLength(0)
  })

  it('is lenient when there is no quick-reply block: success, save, metadata unchanged', async () => {
    const m1 = mkMessage('m1', { other: 'value' })
    const messages = new FakeMessageRepo(new Map([['m1', m1]]))
    const service = new MarkQuickReplyAnsweredService(messages)

    const res = await service.execute({ messageId: 'm1' })

    expect(res.ok).toBe(true)
    expect(messages.saved).toHaveLength(1)
    expect(m1.metadata).toEqual({ other: 'value' })
  })
})
