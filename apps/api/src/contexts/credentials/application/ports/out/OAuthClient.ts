// Driven port for the OAuth2 token endpoints. All HTTP, form-encoding and
// provider quirks live in the adapter (adapters/out/oauth); the application sees
// only these three pure-looking calls.
export interface OAuthClientConfig {
  authUrl: string
  tokenUrl: string
  clientId: string
  clientSecret: string
  scopes?: string[]
  redirectUri: string
  // How client credentials reach the token endpoint: in the form body (default)
  // or as HTTP Basic auth (required by some providers).
  tokenAuthMethod?: 'body' | 'basic'
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  tokenType?: string
}

export interface OAuthClient {
  generateAuthUrl(config: OAuthClientConfig, state: string): string
  exchangeCode(config: OAuthClientConfig, code: string): Promise<OAuthTokens>
  refreshAccessToken(config: OAuthClientConfig, refreshToken: string): Promise<OAuthTokens>
}
