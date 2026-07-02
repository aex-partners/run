import { describe, it, expect } from 'vitest'
import { PostSystemMessageService } from '@/contexts/conversations/application/use-cases/PostSystemMessageService'
import { AppendMessage, AppendMessageCommand, AppendMessageResult } from '@/contexts/conversations/application/ports/in/AppendMessage'
import { Result, ok, fail } from '@/shared/kernel/Result'

const NOW = new Date('2026-01-01T00:00:00Z')

// Records the command it receives and returns a configurable result.
class FakeAppend implements AppendMessage {
  readonly commands: AppendMessageCommand[] = []
  constructor(private result: Result<AppendMessageResult>) {}
  async execute(cmd: AppendMessageCommand): Promise<Result<AppendMessageResult>> {
    this.commands.push(cmd)
    return this.result
  }
}

const appendOk = (id: string): Result<AppendMessageResult> =>
  ok({
    id,
    conversationId: 'c1',
    authorId: null,
    authorName: null,
    content: 'hi',
    role: 'system',
    createdAt: NOW,
  })

describe('PostSystemMessageService', () => {
  it('posts via AppendMessage with no membership guard, defaulting authorId/agentId to null and role to system', async () => {
    const append = new FakeAppend(appendOk('m-1'))
    const service = new PostSystemMessageService(append)

    const res = await service.execute({ conversationId: 'c1', content: 'system notice' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.id).toBe('m-1')
    expect(append.commands).toHaveLength(1)
    expect(append.commands[0]).toMatchObject({
      conversationId: 'c1',
      authorId: null,
      agentId: null,
      content: 'system notice',
      role: 'system',
      requireMembership: false,
    })
  })

  it('passes through a custom role, authorId, and agentId', async () => {
    const append = new FakeAppend(appendOk('m-2'))
    const service = new PostSystemMessageService(append)

    const res = await service.execute({
      conversationId: 'c1',
      content: 'ai turn',
      role: 'ai',
      authorId: 'u1',
      agentId: 'a1',
    })

    expect(res.ok).toBe(true)
    expect(append.commands[0]).toMatchObject({
      role: 'ai',
      authorId: 'u1',
      agentId: 'a1',
      requireMembership: false,
    })
  })

  it('propagates a failure from AppendMessage', async () => {
    const append = new FakeAppend(fail('Message: empty message'))
    const service = new PostSystemMessageService(append)

    const res = await service.execute({ conversationId: 'c1', content: '   ' })

    expect(res.ok).toBe(false)
  })
})
