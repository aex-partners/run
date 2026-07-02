import { describe, it, expect } from 'vitest'
import { CompleteOAuthService } from '@/contexts/credentials/application/use-cases/CompleteOAuthService'
import { CredentialRepository } from '@/contexts/credentials/application/ports/out/CredentialRepository'
import {
  OAuthConfigProvider,
  PluginOAuthConfig,
} from '@/contexts/credentials/application/ports/out/OAuthConfigProvider'
import { StateSigner, OAuthStatePayload } from '@/contexts/credentials/application/ports/out/StateSigner'
import {
  OAuthClient,
  OAuthClientConfig,
  OAuthTokens,
} from '@/contexts/credentials/application/ports/out/OAuthClient'
import { Credential } from '@/contexts/credentials/domain/Credential'
import { CredentialId } from '@/contexts/credentials/domain/ids'
import { CredentialCandidate } from '@/contexts/credentials/domain/CredentialResolution'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00.000Z')
const NOW_SEC = Math.floor(NOW.getTime() / 1000)
const BASE_URL = 'https://app.example.com'

class InMemoryCredentialRepository implements CredentialRepository {
  private seq = 0
  readonly store = new Map<string, Credential>()
  nextId(): CredentialId {
    this.seq += 1
    return CredentialId.of(`cred-${this.seq}`)
  }
  async findById(id: CredentialId): Promise<Credential | null> {
    return this.store.get(id.value) ?? null
  }
  async findActiveCandidatesByPlugin(): Promise<CredentialCandidate[]> {
    return []
  }
  async listOAuth2Ids(): Promise<string[]> {
    return []
  }
  async save(credential: Credential): Promise<void> {
    this.store.set(credential.id.value, credential)
  }
  async delete(id: CredentialId): Promise<void> {
    this.store.delete(id.value)
  }
}

class FakeOAuthConfigProvider implements OAuthConfigProvider {
  readonly configs = new Map<string, PluginOAuthConfig | null>()
  async get(pluginName: string): Promise<PluginOAuthConfig | null> {
    return this.configs.get(pluginName) ?? null
  }
}

class FakeStateSigner implements StateSigner {
  verifyReturn: OAuthStatePayload | null = null
  sign(): string {
    return 'unused'
  }
  verify(): OAuthStatePayload | null {
    return this.verifyReturn
  }
}

class FakeOAuthClient implements OAuthClient {
  readonly exchangeCalls: { config: OAuthClientConfig; code: string }[] = []
  exchangeReturn: OAuthTokens = { accessToken: 'AT', refreshToken: 'RT', expiresIn: 3600, tokenType: 'Bearer' }
  exchangeError: Error | null = null
  generateAuthUrl(): string {
    return 'unused'
  }
  async exchangeCode(config: OAuthClientConfig, code: string): Promise<OAuthTokens> {
    this.exchangeCalls.push({ config, code })
    if (this.exchangeError) throw this.exchangeError
    return this.exchangeReturn
  }
  async refreshAccessToken(): Promise<OAuthTokens> {
    throw new Error('not used')
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const fixedClock = (now: Date): Clock => ({ now: () => now })

const validPayload: OAuthStatePayload = {
  pluginName: 'gmail',
  userId: 'user-1',
  clientId: 'cid',
  clientSecret: 'secret',
}

const setup = () => {
  const credentials = new InMemoryCredentialRepository()
  const config = new FakeOAuthConfigProvider()
  const signer = new FakeStateSigner()
  const oauth = new FakeOAuthClient()
  const events = new RecordingPublisher()
  const service = new CompleteOAuthService(
    credentials,
    config,
    signer,
    oauth,
    events,
    fixedClock(NOW),
    BASE_URL,
  )
  return { credentials, config, signer, oauth, events, service }
}

describe('CompleteOAuthService', () => {
  it('verifies the state, exchanges the code, and persists a fresh oauth2 credential', async () => {
    const { credentials, config, signer, oauth, events, service } = setup()
    signer.verifyReturn = validPayload
    config.configs.set('gmail', {
      authUrl: 'https://auth',
      tokenUrl: 'https://token',
      scope: ['email'],
      tokenAuthMethod: 'basic',
      displayName: 'Gmail',
    })

    const r = await service.execute({ code: 'the-code', state: 'the-state' })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ credentialId: 'cred-1', pluginName: 'gmail' })

    const saved = credentials.store.get('cred-1')
    expect(saved?.type).toBe('oauth2')
    expect(saved?.name).toBe('Gmail (OAuth2)')
    expect(saved?.createdBy).toBe('user-1')
    expect(saved?.value).toMatchObject({
      type: 'OAUTH2',
      access_token: 'AT',
      refresh_token: 'RT',
      expires_in: 3600,
      claimed_at: NOW_SEC,
      client_id: 'cid',
      client_secret: 'secret',
      token_url: 'https://token',
      scope: 'email',
      token_auth_method: 'basic',
    })

    // The exchange used the bound client credentials + the callback redirect URI.
    const call = oauth.exchangeCalls[0]
    expect(call?.code).toBe('the-code')
    expect(call?.config.redirectUri).toBe(`${BASE_URL}/api/credentials/oauth2/callback`)
    expect(call?.config.clientId).toBe('cid')
    expect(call?.config.tokenAuthMethod).toBe('basic')

    expect(events.events.map((e) => e.name)).toEqual(['credentials.CredentialCreated'])
  })

  it('falls back to the plugin name and body auth method when display name / method are absent', async () => {
    const { credentials, config, signer, oauth, service } = setup()
    signer.verifyReturn = validPayload
    config.configs.set('gmail', { authUrl: 'https://auth', tokenUrl: 'https://token' })

    const r = await service.execute({ code: 'c', state: 's' })
    expect(r.ok).toBe(true)
    expect(credentials.store.get('cred-1')?.name).toBe('gmail (OAuth2)')
    expect(oauth.exchangeCalls[0]?.config.tokenAuthMethod).toBe('body')
  })

  it('fails on an invalid/tampered state without exchanging or persisting', async () => {
    const { credentials, oauth, service } = setup()
    // signer.verifyReturn stays null
    const r = await service.execute({ code: 'c', state: 'forged' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Invalid or tampered OAuth state parameter')
    expect(oauth.exchangeCalls).toHaveLength(0)
    expect(credentials.store.size).toBe(0)
  })

  it('fails when the named plugin has no OAuth config', async () => {
    const { credentials, signer, service } = setup()
    signer.verifyReturn = validPayload
    const r = await service.execute({ code: 'c', state: 's' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Plugin "gmail" not found or has no OAuth2 config')
    expect(credentials.store.size).toBe(0)
  })

  it('turns a token-exchange network fault into a Result failure (no 500, nothing persisted)', async () => {
    const { credentials, config, signer, oauth, events, service } = setup()
    signer.verifyReturn = validPayload
    config.configs.set('gmail', { authUrl: 'https://auth', tokenUrl: 'https://token' })
    oauth.exchangeError = new Error('connection refused')

    const r = await service.execute({ code: 'c', state: 's' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('OAuth token exchange failed: connection refused')
    expect(credentials.store.size).toBe(0)
    expect(events.events).toHaveLength(0)
  })
})
