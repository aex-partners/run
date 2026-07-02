import { describe, it, expect } from 'vitest'
import { EditTranscriptionService } from '@/contexts/conversations/application/use-cases/EditTranscriptionService'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { Message, AudioPayload } from '@/contexts/conversations/domain/Message'
import { MessageId } from '@/contexts/conversations/domain/ids'

const NOW = new Date('2026-01-01T00:00:00Z')

const mkMessage = (id: string, authorId: string | null, audio: AudioPayload | null): Message =>
  Message.rehydrate({
    id: MessageId.of(id),
    conversationId: 'c1',
    authorId,
    agentId: null,
    content: '',
    role: 'user',
    metadata: null,
    pinned: false,
    starred: false,
    deletedAt: null,
    deletedFor: [],
    reactions: [],
    audio,
    createdAt: NOW,
  })

const mkAudio = (): AudioPayload => ({
  url: 'http://a',
  duration: '5',
  waveform: null,
  transcription: null,
  transcriptionEdited: false,
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

describe('EditTranscriptionService', () => {
  it('lets the author edit the transcription and saves it with the edited flag set', async () => {
    const m1 = mkMessage('m1', 'author', mkAudio())
    const messages = new FakeMessageRepo(new Map([['m1', m1]]))
    const service = new EditTranscriptionService(messages)

    const res = await service.execute({ messageId: 'm1', userId: 'author', transcription: 'corrected' })

    expect(res.ok).toBe(true)
    expect(messages.saved).toHaveLength(1)
    expect(m1.audio?.transcription).toBe('corrected')
    expect(m1.audio?.transcriptionEdited).toBe(true)
  })

  it('fails when the message does not exist', async () => {
    const messages = new FakeMessageRepo(new Map())
    const service = new EditTranscriptionService(messages)

    const res = await service.execute({ messageId: 'missing', userId: 'author', transcription: 'x' })

    expect(res.ok).toBe(false)
    expect(messages.saved).toHaveLength(0)
  })

  it('fails when the caller is not the author', async () => {
    const m1 = mkMessage('m1', 'author', mkAudio())
    const messages = new FakeMessageRepo(new Map([['m1', m1]]))
    const service = new EditTranscriptionService(messages)

    const res = await service.execute({ messageId: 'm1', userId: 'intruder', transcription: 'x' })

    expect(res.ok).toBe(false)
    expect(messages.saved).toHaveLength(0)
  })

  it('fails when the message has no audio', async () => {
    const m1 = mkMessage('m1', 'author', null)
    const messages = new FakeMessageRepo(new Map([['m1', m1]]))
    const service = new EditTranscriptionService(messages)

    const res = await service.execute({ messageId: 'm1', userId: 'author', transcription: 'x' })

    expect(res.ok).toBe(false)
    expect(messages.saved).toHaveLength(0)
  })
})
