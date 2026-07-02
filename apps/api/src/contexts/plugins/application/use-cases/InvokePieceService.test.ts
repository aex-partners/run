import { describe, it, expect } from 'vitest'
import { InvokePieceService } from '@/contexts/plugins/application/use-cases/InvokePieceService'
import { PieceClient, PieceCall, PieceTriggerCall, PieceTriggerResult } from '@/contexts/plugins/application/ports/out/PieceClient'
import { Json } from '@/shared/domain/Json'
import { Result, ok } from '@/shared/kernel/Result'

class FakeClient implements PieceClient {
  lastCall: PieceCall | null = null
  constructor(private readonly result: Result<Json>) {}
  async call(req: PieceCall): Promise<Result<Json>> {
    this.lastCall = req
    return this.result
  }
  async callTrigger(_req: PieceTriggerCall): Promise<Result<PieceTriggerResult>> {
    return ok({ items: [] })
  }
}

describe('InvokePieceService', () => {
  it('fails when pieceId is missing', async () => {
    const svc = new InvokePieceService(new FakeClient(ok(null)))
    const r = await svc.execute({ pieceId: '', action: 'send', input: {} })
    expect(r.ok).toBe(false)
  })

  it('fails when action is missing', async () => {
    const svc = new InvokePieceService(new FakeClient(ok(null)))
    const r = await svc.execute({ pieceId: 'piece-gmail', action: '', input: {} })
    expect(r.ok).toBe(false)
  })

  it('delegates a valid command to the piece client', async () => {
    const client = new FakeClient(ok({ sent: true }))
    const svc = new InvokePieceService(client)
    const r = await svc.execute({ pieceId: 'piece-gmail', action: 'send_email', input: { to: 'a@b.io' } })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ sent: true })
    expect(client.lastCall).toEqual({ pieceId: 'piece-gmail', action: 'send_email', input: { to: 'a@b.io' } })
  })
})
