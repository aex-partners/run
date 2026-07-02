import { describe, it, expect } from 'vitest'
import { ResolveCredentialService } from '@/contexts/credentials/application/use-cases/ResolveCredentialService'
import { CredentialRepository } from '@/contexts/credentials/application/ports/out/CredentialRepository'
import { TokenCache } from '@/contexts/credentials/application/ports/out/TokenCache'
import {
  RefreshCredential,
  RefreshCredentialCommand,
} from '@/contexts/credentials/application/ports/in/RefreshCredential'
import { Result } from '@/shared/kernel/Result'
import { Credential } from '@/contexts/credentials/domain/Credential'
import { CredentialId } from '@/contexts/credentials/domain/ids'
import { CredentialCandidate } from '@/contexts/credentials/domain/CredentialResolution'
import { CredentialType } from '@/contexts/credentials/domain/CredentialType'
import { CredentialStatus } from '@/contexts/credentials/domain/CredentialStatus'
import { JsonObject } from '@/shared/domain/Json'
import { Clock } from '@/shared/kernel/Clock'

const NOW = new Date('2026-01-01T00:00:00.000Z')
const NOW_SEC = Math.floor(NOW.getTime() / 1000)

const expiringValue = (): JsonObject => ({
  type: 'OAUTH2',
  access_token: 'old-access',
  refresh_token: 'rt-1',
  expires_in: 100,
  claimed_at: NOW_SEC - 100,
  token_url: 'https://token',
})
const freshValue = (): JsonObject => ({ ...expiringValue(), expires_in: 100000, claimed_at: NOW_SEC })

class InMemoryCredentialRepository implements CredentialRepository {
  private seq = 0
  readonly store = new Map<string, Credential>()
  readonly findByIdCalls: string[] = []
  nextId(): CredentialId {
    this.seq += 1
    return CredentialId.of(`cred-${this.seq}`)
  }
  async findById(id: CredentialId): Promise<Credential | null> {
    this.findByIdCalls.push(id.value)
    return this.store.get(id.value) ?? null
  }
  async findActiveCandidatesByPlugin(pluginName: string): Promise<CredentialCandidate[]> {
    return [...this.store.values()]
      .filter((c) => c.pluginName === pluginName && c.status === 'active')
      .map((c) => ({ id: c.id.value, isPrimary: c.isPrimary, createdAt: c.createdAt, status: c.status }))
  }
  async listOAuth2Ids(): Promise<string[]> {
    return [...this.store.values()].filter((c) => c.type === 'oauth2').map((c) => c.id.value)
  }
  async save(credential: Credential): Promise<void> {
    this.store.set(credential.id.value, credential)
  }
  async delete(id: CredentialId): Promise<void> {
    this.store.delete(id.value)
  }
}

class InMemoryTokenCache implements TokenCache {
  readonly store = new Map<string, JsonObject>()
  readonly setCalls: string[] = []
  get(id: string): JsonObject | null {
    return this.store.get(id) ?? null
  }
  set(id: string, value: JsonObject): void {
    this.store.set(id, value)
    this.setCalls.push(id)
  }
  invalidate(id: string): void {
    this.store.delete(id)
  }
  clear(): void {
    this.store.clear()
  }
}

class FakeRefreshCredential implements RefreshCredential {
  readonly calls: RefreshCredentialCommand[] = []
  constructor(private readonly onExecute?: (cmd: RefreshCredentialCommand) => void) {}
  async execute(cmd: RefreshCredentialCommand): Promise<Result<{ total: number; refreshed: number }>> {
    this.calls.push(cmd)
    this.onExecute?.(cmd)
    return { ok: true, value: { total: 1, refreshed: 1 } }
  }
}

const fixedClock = (now: Date): Clock => ({ now: () => now })

const seed = (
  id: string,
  over: {
    pluginName?: string
    type?: CredentialType
    status?: CredentialStatus
    isPrimary?: boolean
    value?: JsonObject
    createdAt?: Date
  } = {},
): Credential =>
  Credential.rehydrate({
    id: CredentialId.of(id),
    name: id,
    pluginName: over.pluginName ?? 'gmail',
    type: over.type ?? 'secret_text',
    status: over.status ?? 'active',
    isPrimary: over.isPrimary ?? false,
    value: over.value ?? { token: id },
    createdBy: 'owner',
    createdAt: over.createdAt ?? NOW,
    updatedAt: NOW,
  })

const setup = (refresh: RefreshCredential = new FakeRefreshCredential()) => {
  const credentials = new InMemoryCredentialRepository()
  const cache = new InMemoryTokenCache()
  const service = new ResolveCredentialService(credentials, refresh, cache, fixedClock(NOW))
  return { credentials, cache, refresh, service }
}

describe('ResolveCredentialService', () => {
  it('resolves an explicit id and returns its decrypted value (non-oauth values are not cached)', async () => {
    const { credentials, cache, service } = setup()
    credentials.store.set('cred-1', seed('cred-1', { value: { token: 'secret' } }))

    const r = await service.execute({ pluginName: 'gmail', credentialId: 'cred-1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ token: 'secret' })
    expect(cache.setCalls).toEqual([])
  })

  it('without an explicit id, applies the precedence rule (primary wins) over the plugin candidates', async () => {
    const { credentials, service } = setup()
    credentials.store.set('old', seed('old', { createdAt: new Date('2025-01-01T00:00:00Z'), value: { v: 'old' } }))
    credentials.store.set('primary', seed('primary', { isPrimary: true, value: { v: 'primary' } }))

    const r = await service.execute({ pluginName: 'gmail' })
    expect(r.ok && r.value).toEqual({ v: 'primary' })
  })

  it('serves a warm cache hit without touching the repository', async () => {
    const { credentials, cache, service } = setup()
    cache.store.set('cred-1', { cached: true })

    const r = await service.execute({ pluginName: 'gmail', credentialId: 'cred-1' })
    expect(r.ok && r.value).toEqual({ cached: true })
    expect(credentials.findByIdCalls).toEqual([])
  })

  it('returns null when no candidate exists for the plugin', async () => {
    const { service } = setup()
    const r = await service.execute({ pluginName: 'gmail' })
    expect(r.ok && r.value).toBeNull()
  })

  it('returns null when an explicit id is not found', async () => {
    const { service } = setup()
    const r = await service.execute({ pluginName: 'gmail', credentialId: 'ghost' })
    expect(r.ok && r.value).toBeNull()
  })

  it('auto-refreshes a near-expiry oauth2 token, re-reads, and caches the fresh value', async () => {
    const refreshed = { ...expiringValue(), access_token: 'fresh-access' }
    const credentials = new InMemoryCredentialRepository()
    const cache = new InMemoryTokenCache()
    const refresh = new FakeRefreshCredential(() => {
      credentials.store.set('cred-1', seed('cred-1', { type: 'oauth2', value: refreshed }))
    })
    const service = new ResolveCredentialService(credentials, refresh, cache, fixedClock(NOW))
    credentials.store.set('cred-1', seed('cred-1', { type: 'oauth2', value: expiringValue() }))

    const r = await service.execute({ pluginName: 'gmail', credentialId: 'cred-1' })
    expect(r.ok && r.value).toMatchObject({ access_token: 'fresh-access' })
    expect(refresh.calls).toEqual([{ credentialId: 'cred-1' }])
    expect(cache.store.get('cred-1')).toMatchObject({ access_token: 'fresh-access' })
  })

  it('caches an oauth2 value that does not need refresh (no refresh call)', async () => {
    const { credentials, cache, refresh, service } = setup()
    credentials.store.set('cred-1', seed('cred-1', { type: 'oauth2', value: freshValue() }))

    const r = await service.execute({ pluginName: 'gmail', credentialId: 'cred-1' })
    expect(r.ok).toBe(true)
    expect((refresh as FakeRefreshCredential).calls).toEqual([])
    expect(cache.setCalls).toEqual(['cred-1'])
  })

  it('does not refresh an oauth2 token that lacks a refresh_token, but still caches it', async () => {
    const { credentials, cache, refresh, service } = setup()
    const value = { ...expiringValue(), refresh_token: '' }
    credentials.store.set('cred-1', seed('cred-1', { type: 'oauth2', value }))

    const r = await service.execute({ pluginName: 'gmail', credentialId: 'cred-1' })
    expect(r.ok).toBe(true)
    expect((refresh as FakeRefreshCredential).calls).toEqual([])
    expect(cache.setCalls).toEqual(['cred-1'])
  })

  it('returns null when the credential disappears during refresh', async () => {
    const credentials = new InMemoryCredentialRepository()
    const cache = new InMemoryTokenCache()
    const refresh = new FakeRefreshCredential(() => credentials.store.delete('cred-1'))
    const service = new ResolveCredentialService(credentials, refresh, cache, fixedClock(NOW))
    credentials.store.set('cred-1', seed('cred-1', { type: 'oauth2', value: expiringValue() }))

    const r = await service.execute({ pluginName: 'gmail', credentialId: 'cred-1' })
    expect(r.ok && r.value).toBeNull()
  })
})
