// ACL out-port. The OAuth2 endpoints (authUrl/tokenUrl/scope) for a plugin live
// in the plugin catalog, which is OWNED BY ANOTHER CONTEXT. The credentials
// context must not import it: the composition root (main) bridges this port to
// the catalog's read side. Declared here as a plain interface only.
export interface PluginOAuthConfig {
  authUrl: string
  tokenUrl: string
  scope?: string[]
  tokenAuthMethod?: 'body' | 'basic'
  // Human-facing plugin name, used to label the credential created on callback.
  displayName?: string
}

export interface OAuthConfigProvider {
  get(pluginName: string): Promise<PluginOAuthConfig | null>
}
