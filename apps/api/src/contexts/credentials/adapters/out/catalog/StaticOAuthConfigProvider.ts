import {
  OAuthConfigProvider,
  PluginOAuthConfig,
} from '@/contexts/credentials/application/ports/out/OAuthConfigProvider'

// Driven ACL adapter for the OAuthConfigProvider port. The real plugin OAuth
// config lives in the plugin catalog (owned by another context). This adapter is
// a thin lookup over a map injected by main — wire it to the catalog's read side
// (e.g. piece-catalog.json / a plugins-context query) at composition time. Only
// oauth2 plugins with both endpoints should be registered here.
export class StaticOAuthConfigProvider implements OAuthConfigProvider {
  constructor(private readonly configs: Readonly<Record<string, PluginOAuthConfig>>) {}

  async get(pluginName: string): Promise<PluginOAuthConfig | null> {
    return this.configs[pluginName] ?? null
  }
}
