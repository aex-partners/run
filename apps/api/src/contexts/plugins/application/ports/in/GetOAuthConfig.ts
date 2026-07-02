import { Result } from '@/shared/kernel/Result'

// Driving port of the plugins context for OAuth2 endpoint discovery. The
// credentials context reaches this only via its OAuthConfigProvider ACL, wired in
// main — never by importing this file directly. The OAuth2 endpoints live in the
// piece catalog's `auth` props (source `pieces/oauth2-handler.ts`
// `getPluginOAuthConfig`).
export interface OAuthConfig {
  authUrl: string
  tokenUrl: string
  // Space-delimited scope string as declared by the piece (may be absent).
  scope?: string
  // 'body' | 'basic' as declared by the piece; surfaced verbatim as a string.
  tokenAuthMethod?: string
  // Human-facing plugin name, used to label the credential created on callback.
  displayName?: string
}

export interface GetOAuthConfigCommand {
  pieceName: string
}

// Resolves to the piece's OAuth2 config, or `null` when the piece is unknown or
// does not declare a usable oauth2 auth (missing authUrl/tokenUrl).
export interface GetOAuthConfig {
  execute(cmd: GetOAuthConfigCommand): Promise<Result<OAuthConfig | null>>
}
