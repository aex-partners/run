import { describe, it, expect } from 'vitest'
import { InvokePieceTriggerService } from '@/contexts/plugins/application/use-cases/InvokePieceTriggerService'
import { PieceRegistry, PieceCatalogEntry } from '@/contexts/plugins/application/ports/out/PieceRegistry'
import {
  PieceClient,
  PieceCall,
  PieceTriggerCall,
  PieceTriggerResult,
} from '@/contexts/plugins/application/ports/out/PieceClient'
import { PieceMetadata } from '@/contexts/plugins/domain/PieceMetadata'
import { Json } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'

function meta(): PieceMetadata {
  return {
    pieceName: 'piece-gmail',
    displayName: 'Gmail',
    hasAuth: true,
    actions: [],
    triggers: [
      { name: 'new_email', displayName: 'New Email', requireAuth: true, type: 'POLLING', props: [] },
    ],
  }
}

function fakeRegistry(metadata: PieceMetadata | null): PieceRegistry {
  return {
    async loadMetadata(): Promise<PieceMetadata | null> {
      return metadata
    },
    async listCatalog(): Promise<PieceCatalogEntry[]> {
      return []
    },
  }
}

class FakeClient implements PieceClient {
  lastTrigger: PieceTriggerCall | null = null
  constructor(private readonly result: Result<PieceTriggerResult>) {}
  async call(_req: PieceCall): Promise<Result<Json>> {
    return ok(null)
  }
  async callTrigger(req: PieceTriggerCall): Promise<Result<PieceTriggerResult>> {
    this.lastTrigger = req
    return this.result
  }
}

const ctx = { flowId: 'flow-1' }

describe('InvokePieceTriggerService', () => {
  it('fails when pieceName or triggerName is missing', async () => {
    const svc = new InvokePieceTriggerService(fakeRegistry(meta()), new FakeClient(ok({ items: [] })))
    const r = await svc.execute({ pieceName: '', triggerName: '', action: 'run', input: {}, context: ctx })
    expect(r.ok).toBe(false)
  })

  it('fails when the piece is not found / not installed', async () => {
    const svc = new InvokePieceTriggerService(fakeRegistry(null), new FakeClient(ok({ items: [] })))
    const r = await svc.execute({
      pieceName: 'piece-gmail',
      triggerName: 'new_email',
      action: 'run',
      input: {},
      context: ctx,
    })
    expect(r.ok).toBe(false)
  })

  it('fails when the trigger is not declared by the piece', async () => {
    const svc = new InvokePieceTriggerService(fakeRegistry(meta()), new FakeClient(ok({ items: [] })))
    const r = await svc.execute({
      pieceName: 'piece-gmail',
      triggerName: 'nope',
      action: 'run',
      input: {},
      context: ctx,
    })
    expect(r.ok).toBe(false)
  })

  it('run surfaces the emitted items verbatim', async () => {
    const client = new FakeClient(ok({ items: [{ id: 1 }, { id: 2 }] }))
    const svc = new InvokePieceTriggerService(fakeRegistry(meta()), client)
    const r = await svc.execute({
      pieceName: 'piece-gmail',
      triggerName: 'new_email',
      action: 'run',
      input: {},
      context: ctx,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual([{ id: 1 }, { id: 2 }])
    expect(client.lastTrigger?.hook).toBe('run')
  })

  it('onEnable surfaces the subscription descriptor (strategy + schedule)', async () => {
    const client = new FakeClient(
      ok({ items: [], strategy: 'POLLING', scheduledCron: '*/5 * * * *', scheduledTimezone: 'UTC' }),
    )
    const svc = new InvokePieceTriggerService(fakeRegistry(meta()), client)
    const r = await svc.execute({
      pieceName: 'piece-gmail',
      triggerName: 'new_email',
      action: 'onEnable',
      input: {},
      context: ctx,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toEqual({ strategy: 'POLLING', scheduledCron: '*/5 * * * *', scheduledTimezone: 'UTC' })
    }
  })

  it('propagates a client failure', async () => {
    const svc = new InvokePieceTriggerService(fakeRegistry(meta()), new FakeClient(fail('dispatch failed')))
    const r = await svc.execute({
      pieceName: 'piece-gmail',
      triggerName: 'new_email',
      action: 'run',
      input: {},
      context: ctx,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('dispatch failed')
  })
})
