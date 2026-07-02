import { describe, it, expect } from 'vitest'
import { VerifyImapService } from '@/contexts/email/application/use-cases/VerifyImapService'
import { ImapClient, FetchResult } from '@/contexts/email/application/ports/out/ImapClient'
import { ImapSettings } from '@/contexts/email/domain/EmailAccount'

class FakeImapClient implements ImapClient {
  readonly verified: ImapSettings[] = []
  constructor(private readonly result: { ok: boolean; error?: string }) {}
  async fetchAll(): Promise<FetchResult> {
    return { messages: [], errors: 0 }
  }
  async verify(settings: ImapSettings): Promise<{ ok: boolean; error?: string }> {
    this.verified.push(settings)
    return this.result
  }
}

const cmd = {
  host: 'imap.work.com',
  port: 993,
  user: 'me@work.com',
  pass: 'secret',
  secure: true,
}

describe('VerifyImapService', () => {
  it('reports a successful connection and forwards the raw credentials unchanged', async () => {
    const imap = new FakeImapClient({ ok: true })
    const service = new VerifyImapService(imap)
    const res = await service.execute(cmd)
    expect(res.ok).toBe(true)
    expect(res.ok && res.value).toEqual({ ok: true })
    expect(imap.verified).toEqual([{ host: 'imap.work.com', port: 993, user: 'me@work.com', pass: 'secret', secure: true }])
  })

  it('reports a failed connection as ok:false with the error, still a successful Result', async () => {
    const imap = new FakeImapClient({ ok: false, error: 'auth failed' })
    const service = new VerifyImapService(imap)
    const res = await service.execute(cmd)
    expect(res.ok).toBe(true)
    expect(res.ok && res.value).toEqual({ ok: false, error: 'auth failed' })
  })
})
