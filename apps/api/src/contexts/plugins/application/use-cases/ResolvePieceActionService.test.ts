import { describe, it, expect } from 'vitest'
import { ResolvePieceActionService } from '@/contexts/plugins/application/use-cases/ResolvePieceActionService'
import { PieceRegistry, PieceCatalogEntry } from '@/contexts/plugins/application/ports/out/PieceRegistry'
import {
  PieceClient,
  PieceCall,
  PieceTriggerCall,
  PieceTriggerResult,
} from '@/contexts/plugins/application/ports/out/PieceClient'
import {
  ResolveCredential,
  ResolveCredentialRequest,
} from '@/contexts/plugins/application/ports/out/ResolveCredential'
import { PieceMetadata } from '@/contexts/plugins/domain/PieceMetadata'
import { Json, JsonObject } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'

function meta(over: Partial<PieceMetadata> = {}): PieceMetadata {
  return {
    pieceName: 'piece-gmail',
    displayName: 'Gmail',
    hasAuth: true,
    actions: [{ name: 'send_email', displayName: 'Send', requireAuth: true, props: [] }],
    triggers: [],
    ...over,
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

function fakeCredentials(result: Result<JsonObject | null>): ResolveCredential {
  return {
    async resolve(_req: ResolveCredentialRequest): Promise<Result<JsonObject | null>> {
      return result
    },
  }
}

class FakeClient implements PieceClient {
  lastCall: PieceCall | null = null
  constructor(private readonly result: Result<Json> = ok({ done: true })) {}
  async call(req: PieceCall): Promise<Result<Json>> {
    this.lastCall = req
    return this.result
  }
  async callTrigger(_req: PieceTriggerCall): Promise<Result<PieceTriggerResult>> {
    return ok({ items: [] })
  }
}

describe('ResolvePieceActionService', () => {
  it('fails when the piece is not found / not installed', async () => {
    const svc = new ResolvePieceActionService(
      fakeRegistry(null),
      fakeCredentials(ok(null)),
      new FakeClient(),
    )
    const r = await svc.execute({ pieceName: 'piece-gmail', actionName: 'send_email', input: {} })
    expect(r.ok).toBe(false)
  })

  it('fails when the action is not declared by the piece', async () => {
    const svc = new ResolvePieceActionService(
      fakeRegistry(meta()),
      fakeCredentials(ok({ token: 'x' })),
      new FakeClient(),
    )
    const r = await svc.execute({ pieceName: 'piece-gmail', actionName: 'nope', input: {} })
    expect(r.ok).toBe(false)
  })

  it('fails when credential resolution fails', async () => {
    const svc = new ResolvePieceActionService(
      fakeRegistry(meta()),
      fakeCredentials(fail('credentials context unavailable')),
      new FakeClient(),
    )
    const r = await svc.execute({ pieceName: 'piece-gmail', actionName: 'send_email', input: {} })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('credentials context unavailable')
  })

  it('auth gate: fails when the piece needs auth but none resolved', async () => {
    const client = new FakeClient()
    const svc = new ResolvePieceActionService(fakeRegistry(meta()), fakeCredentials(ok(null)), client)
    const r = await svc.execute({ pieceName: 'piece-gmail', actionName: 'send_email', input: {} })
    expect(r.ok).toBe(false)
    // Never runs the action when the gate trips.
    expect(client.lastCall).toBeNull()
  })

  it('runs the action with the resolved credential on the happy path', async () => {
    const client = new FakeClient(ok({ messageId: 'm1' }))
    const svc = new ResolvePieceActionService(
      fakeRegistry(meta()),
      fakeCredentials(ok({ token: 'abc' })),
      client,
    )
    const r = await svc.execute({
      pieceName: 'piece-gmail',
      actionName: 'send_email',
      input: { to: 'a@b.io' },
      credentialId: 'cred-1',
      userId: 'u-1',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ messageId: 'm1' })
    expect(client.lastCall).toEqual({
      pieceId: 'piece-gmail',
      action: 'send_email',
      input: { to: 'a@b.io' },
      auth: { token: 'abc' },
      credentialId: 'cred-1',
      userId: 'u-1',
    })
  })

  it('does not gate a no-auth piece even when no credential resolves', async () => {
    const noAuth = meta({
      hasAuth: false,
      actions: [{ name: 'get_url', displayName: 'GET', requireAuth: true, props: [] }],
    })
    const client = new FakeClient(ok({ status: 200 }))
    const svc = new ResolvePieceActionService(fakeRegistry(noAuth), fakeCredentials(ok(null)), client)
    const r = await svc.execute({ pieceName: 'piece-gmail', actionName: 'get_url', input: {} })
    expect(r.ok).toBe(true)
    expect(client.lastCall?.auth).toBeNull()
  })
})
