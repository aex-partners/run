import {
  OAuthClient,
  OAuthClientConfig,
  OAuthTokens,
} from '@/contexts/credentials/application/ports/out/OAuthClient'

// Driven adapter for the OAuth2 token endpoints, ported 1:1 from the source
// integrations/oauth.ts. fetch-based, form-encoded, 15s timeout. Client creds go
// in the body by default, or as HTTP Basic when the provider requires it.
export class FetchOAuthClient implements OAuthClient {
  generateAuthUrl(config: OAuthClientConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
    })
    if (config.scopes?.length) {
      params.set('scope', config.scopes.join(' '))
    }
    return `${config.authUrl}?${params.toString()}`
  }

  async exchangeCode(config: OAuthClientConfig, code: string): Promise<OAuthTokens> {
    const data = await this.post(config, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    })
    return {
      accessToken: asString(data.access_token),
      refreshToken: asOptionalString(data.refresh_token),
      expiresIn: asOptionalNumber(data.expires_in),
      tokenType: asOptionalString(data.token_type),
    }
  }

  async refreshAccessToken(config: OAuthClientConfig, refreshToken: string): Promise<OAuthTokens> {
    const data = await this.post(config, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    return {
      accessToken: asString(data.access_token),
      refreshToken: asOptionalString(data.refresh_token) ?? refreshToken,
      expiresIn: asOptionalNumber(data.expires_in),
    }
  }

  private async post(
    config: OAuthClientConfig,
    bodyParams: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    }
    const params = new URLSearchParams(bodyParams)
    if (config.tokenAuthMethod === 'basic') {
      const creds = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
      headers.Authorization = `Basic ${creds}`
    } else {
      params.set('client_id', config.clientId)
      params.set('client_secret', config.clientSecret)
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: params,
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      const errBody = await response.text()
      throw new Error(`OAuth token request failed: ${response.status} ${errBody}`)
    }
    return (await response.json()) as Record<string, unknown>
  }
}

const asString = (v: unknown): string => (typeof v === 'string' ? v : '')
const asOptionalString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const asOptionalNumber = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
