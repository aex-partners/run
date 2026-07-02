import { describe, it, expect } from 'vitest'
import { StartOAuthService } from '@/contexts/credentials/application/use-cases/StartOAuthService'
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

const BASE_URL = 'https://app.example.com'
const REDIRECT_URI = `${BASE_URL}/api/credentials/oauth2/callback`

class FakeOAuthConfigProvider implements OAuthConfigProvider {
  readonly configs = new Map<string, PluginOAuthConfig | null>()
  async get(pluginName: string): Promise<PluginOAuthConfig | null> {
    return this.configs.get(pluginName) ?? null
  }
}

class FakeStateSigner implements StateSigner {
  readonly signed: OAuthStatePayload[] = []
  verifyReturn: OAuthStatePayload | null = null
  sign(payload: OAuthStatePayload): string {
    this.signed.push(payload)
    return `signed:${payload.pluginName}:${payload.userId}`
  }
  verify(): OAuthStatePayload | null {
    return this.verifyReturn
  }
}

class FakeOAuthClient implements OAuthClient {
  readonly generateAuthUrlCalls: { config: OAuthClientConfig; state: string }[] = []
  generateAuthUrl(config: OAuthClientConfig, state: string): string {
    this.generateAuthUrlCalls.push({ config, state })
    return `${config.authUrl}?state=${encodeURIComponent(state)}`
  }
  async exchangeCode(): Promise<OAuthTokens> {
    throw new Error('not used')
  }
  async refreshAccessToken(): Promise<OAuthTokens> {
    throw new Error('not used')
  }
}

const setup = () => {
  const config = new FakeOAuthConfigProvider()
  const signer = new FakeStateSigner()
  const oauth = new FakeOAuthClient()
  const service = new StartOAuthService(config, signer, oauth, BASE_URL)
  return { config, signer, oauth, service }
}

describe('StartOAuthService', () => {
  it('signs a bound state and builds the provider authorization URL', async () => {
    const { config, signer, oauth, service } = setup()
    config.configs.set('gmail', {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: ['email', 'profile'],
      tokenAuthMethod: 'body',
      displayName: 'Gmail',
    })

    const r = await service.execute({
      pluginName: 'gmail',
      clientId: 'cid',
      clientSecret: 'secret',
      userId: 'user-1',
    })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.url).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth?state=signed%3Agmail%3Auser-1',
    )

    // The client id/secret are bound into the signed state, not the URL params.
    expect(signer.signed).toEqual([
      { pluginName: 'gmail', userId: 'user-1', clientId: 'cid', clientSecret: 'secret' },
    ])

    const call = oauth.generateAuthUrlCalls[0]
    expect(call?.config.redirectUri).toBe(REDIRECT_URI)
    expect(call?.config.authUrl).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(call?.config.tokenUrl).toBe('https://oauth2.googleapis.com/token')
    expect(call?.config.clientId).toBe('cid')
    expect(call?.config.scopes).toEqual(['email', 'profile'])
    expect(call?.state).toBe('signed:gmail:user-1')
  })

  it('fails when the plugin has no OAuth config', async () => {
    const { signer, oauth, service } = setup()
    const r = await service.execute({ pluginName: 'unknown', clientId: 'c', clientSecret: 's', userId: 'u' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Plugin does not support OAuth2')
    expect(signer.signed).toHaveLength(0)
    expect(oauth.generateAuthUrlCalls).toHaveLength(0)
  })

  it('fails when the config is present but missing the authUrl/tokenUrl endpoints', async () => {
    const { config, service } = setup()
    config.configs.set('half', { authUrl: '', tokenUrl: '' })
    const r = await service.execute({ pluginName: 'half', clientId: 'c', clientSecret: 's', userId: 'u' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Plugin does not support OAuth2')
  })
})
