import { describe, it, expect } from 'vitest'
import { RefreshCredentialService } from '@/contexts/credentials/application/use-cases/RefreshCredentialService'
import { CredentialRepository } from '@/contexts/credentials/application/ports/out/CredentialRepository'
import { TokenCache } from '@/contexts/credentials/application/ports/out/TokenCache'
import {
  OAuthClient,
  OAuthClientConfig,
  OAuthTokens,
} from '@/contexts/credentials/application/ports/out/OAuthClient'
import { Credential } from '@/contexts/credentials/domain/Credential'
import { CredentialId } from '@/contexts/credentials/domain/ids'
import { CredentialCandidate } from '@/contexts/credentials/domain/CredentialResolution'
import { CredentialType } from '@/contexts/credentials/domain/CredentialType'
import { CredentialStatus } from '@/contexts/credentials/domain/CredentialStatus'
import { JsonObject } from '@/shared/domain/Json'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00.000Z')
const NOW_SEC = Math.floor(NOW.getTime() / 1000)

// A token that is within the 60s refresh skew (expiresAt === now), and refreshable.
const refreshableExpiringValue = (): JsonObject => ({
  type: 'OAUTH2',
  access_token: 'old-access',
  refresh_token: 'rt-1',
  expires_in: 100,
  claimed_at: NOW_SEC - 100,
  token_url: 'https://token',
  client_id: 'cid',
  client_secret: 'secret',
  token_auth_method: 'body',
})

// A token far from expiry: no refresh needed.
const freshValue = (): JsonObject => ({
  ...refreshableExpiringValue(),
  expires_in: 100000,
  claimed_at: NOW_SEC,
})

class InMemoryCredentialRepository implements CredentialRepository {
  private seq = 0
  readonly store = new Map<string, Credential>()
  readonly failFindByIdFor = new Set<string>()
  nextId(): CredentialId {
    this.seq += 1
    return CredentialId.of(`cred-${this.seq}`)
  }
  async findById(id: CredentialId): Promise<Credential | null> {
    if (this.failFindByIdFor.has(id.value)) throw new Error('boom')
    return this.store.get(id.value) ?? null
  }
  async findActiveCandidatesByPlugin(): Promise<CredentialCandidate[]> {
    return []
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
  readonly invalidated: string[] = []
  get(id: string): JsonObject | null {
    return this.store.get(id) ?? null
  }
  set(id: string, value: JsonObject): void {
    this.store.set(id, value)
  }
  invalidate(id: string): void {
    this.store.delete(id)
    this.invalidated.push(id)
  }
  clear(): void {
    this.store.clear()
  }
}

class FakeOAuthClient implements OAuthClient {
  readonly refreshCalls: { config: OAuthClientConfig; refreshToken: string }[] = []
  refreshReturn: OAuthTokens = { accessToken: 'new-access', refreshToken: 'rt-2', expiresIn: 200 }
  refreshError: Error | null = null
  generateAuthUrl(): string {
    return 'unused'
  }
  async exchangeCode(): Promise<OAuthTokens> {
    throw new Error('not used')
  }
  async refreshAccessToken(config: OAuthClientConfig, refreshToken: string): Promise<OAuthTokens> {
    this.refreshCalls.push({ config, refreshToken })
    if (this.refreshError) throw this.refreshError
    return this.refreshReturn
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const fixedClock = (now: Date): Clock => ({ now: () => now })

const seed = (
  id: string,
  over: { type?: CredentialType; status?: CredentialStatus; value?: JsonObject } = {},
): Credential =>
  Credential.rehydrate({
    id: CredentialId.of(id),
    name: id,
    pluginName: 'gmail',
    type: over.type ?? 'oauth2',
    status: over.status ?? 'active',
    isPrimary: false,
    value: over.value ?? refreshableExpiringValue(),
    createdBy: 'owner',
    createdAt: NOW,
    updatedAt: NOW,
  })

const setup = () => {
  const credentials = new InMemoryCredentialRepository()
  const cache = new InMemoryTokenCache()
  const oauth = new FakeOAuthClient()
  const events = new RecordingPublisher()
  const service = new RefreshCredentialService(credentials, oauth, cache, events, fixedClock(NOW))
  return { credentials, cache, oauth, events, service }
}

describe('RefreshCredentialService', () => {
  it('refreshes a single near-expiry token: folds in new tokens, reactivates, invalidates cache, publishes', async () => {
    const { credentials, cache, oauth, events, service } = setup()
    credentials.store.set('cred-1', seed('cred-1', { status: 'error' }))

    const r = await service.execute({ credentialId: 'cred-1' })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ total: 1, refreshed: 1 })

    expect(oauth.refreshCalls[0]?.refreshToken).toBe('rt-1')
    expect(oauth.refreshCalls[0]?.config.tokenUrl).toBe('https://token')

    const saved = credentials.store.get('cred-1')
    expect(saved?.status).toBe('active')
    expect(saved?.value).toMatchObject({
      access_token: 'new-access',
      refresh_token: 'rt-2',
      expires_in: 200,
      claimed_at: NOW_SEC,
    })
    expect(cache.invalidated).toEqual(['cred-1'])
    expect(events.events.map((e) => e.name)).toEqual(['credentials.CredentialRefreshed'])
  })

  it('counts an already-valid token as refreshed without calling the provider', async () => {
    const { credentials, oauth, events, service } = setup()
    credentials.store.set('cred-1', seed('cred-1', { value: freshValue() }))

    const r = await service.execute({ credentialId: 'cred-1' })
    expect(r.ok && r.value).toEqual({ total: 1, refreshed: 1 })
    expect(oauth.refreshCalls).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('skips a non-oauth2 credential (refreshed: 0)', async () => {
    const { credentials, oauth, service } = setup()
    credentials.store.set('cred-1', seed('cred-1', { type: 'secret_text', value: { token: 'x' } }))

    const r = await service.execute({ credentialId: 'cred-1' })
    expect(r.ok && r.value).toEqual({ total: 1, refreshed: 0 })
    expect(oauth.refreshCalls).toHaveLength(0)
  })

  it('skips an oauth2 credential that cannot be refreshed (no refresh_token)', async () => {
    const { credentials, oauth, service } = setup()
    credentials.store.set(
      'cred-1',
      seed('cred-1', { value: { ...refreshableExpiringValue(), refresh_token: '' } }),
    )

    const r = await service.execute({ credentialId: 'cred-1' })
    expect(r.ok && r.value).toEqual({ total: 1, refreshed: 0 })
    expect(oauth.refreshCalls).toHaveLength(0)
  })

  it('counts a missing id as total 1 / refreshed 0', async () => {
    const { service } = setup()
    const r = await service.execute({ credentialId: 'ghost' })
    expect(r.ok && r.value).toEqual({ total: 1, refreshed: 0 })
  })

  it('flips the credential to error (not throwing) when the provider refresh fails', async () => {
    const { credentials, cache, oauth, events, service } = setup()
    credentials.store.set('cred-1', seed('cred-1'))
    oauth.refreshError = new Error('provider 500')

    const r = await service.execute({ credentialId: 'cred-1' })
    expect(r.ok && r.value).toEqual({ total: 1, refreshed: 0 })

    const saved = credentials.store.get('cred-1')
    expect(saved?.status).toBe('error')
    // value left as-is (still the old token bag)
    expect(saved?.value).toMatchObject({ access_token: 'old-access' })
    expect(cache.invalidated).toEqual(['cred-1'])
    expect(events.events.map((e) => e.name)).toEqual(['credentials.CredentialUpdated'])
  })

  it('refreshes the whole batch when no id is given (listOAuth2Ids work list)', async () => {
    const { credentials, oauth, service } = setup()
    credentials.store.set('cred-1', seed('cred-1'))
    credentials.store.set('cred-2', seed('cred-2', { value: freshValue() }))
    credentials.store.set('cred-3', seed('cred-3', { type: 'secret_text', value: {} }))

    const r = await service.execute({})
    // cred-1 refreshed (provider), cred-2 still valid (counted), cred-3 non-oauth2 (skipped)
    expect(r.ok && r.value).toEqual({ total: 2, refreshed: 2 })
    expect(oauth.refreshCalls).toHaveLength(1)
  })

  it('isolates a per-credential fault: a throwing lookup does not abort the batch', async () => {
    const { credentials, service } = setup()
    credentials.store.set('cred-1', seed('cred-1'))
    credentials.store.set('cred-2', seed('cred-2', { value: freshValue() }))
    credentials.failFindByIdFor.add('cred-1')

    const r = await service.execute({})
    // cred-1 throws and is swallowed; cred-2 still processed and counted.
    expect(r.ok && r.value).toEqual({ total: 2, refreshed: 1 })
  })
})
