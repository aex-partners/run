import { describe, it, expect } from 'vitest'
import { VerifySmtpService } from '@/contexts/email/application/use-cases/VerifySmtpService'
import { SmtpSender, OutgoingEmail, SmtpSendResult } from '@/contexts/email/application/ports/out/SmtpSender'
import { SmtpSettings } from '@/contexts/email/domain/EmailAccount'

class FakeSmtpSender implements SmtpSender {
  readonly verified: SmtpSettings[] = []
  constructor(private readonly result: { ok: boolean; error?: string }) {}
  async send(_settings: SmtpSettings, _message: OutgoingEmail): Promise<SmtpSendResult> {
    return { messageId: 'm', accepted: [], rejected: [] }
  }
  async verify(settings: SmtpSettings): Promise<{ ok: boolean; error?: string }> {
    this.verified.push(settings)
    return this.result
  }
}

const cmd = {
  host: 'smtp.work.com',
  port: 587,
  user: 'me@work.com',
  pass: 'secret',
  from: 'me@work.com',
  secure: true,
}

describe('VerifySmtpService', () => {
  it('reports a successful connection and forwards the raw credentials (fromName null)', async () => {
    const sender = new FakeSmtpSender({ ok: true })
    const service = new VerifySmtpService(sender)
    const res = await service.execute(cmd)
    expect(res.ok).toBe(true)
    expect(res.ok && res.value).toEqual({ ok: true })
    expect(sender.verified).toEqual([
      { host: 'smtp.work.com', port: 587, user: 'me@work.com', pass: 'secret', from: 'me@work.com', fromName: null, secure: true },
    ])
  })

  it('reports a failed connection as ok:false with the error, still a successful Result', async () => {
    const sender = new FakeSmtpSender({ ok: false, error: 'connection refused' })
    const service = new VerifySmtpService(sender)
    const res = await service.execute(cmd)
    expect(res.ok).toBe(true)
    expect(res.ok && res.value).toEqual({ ok: false, error: 'connection refused' })
  })
})
