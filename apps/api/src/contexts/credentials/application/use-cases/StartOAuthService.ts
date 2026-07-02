import { Result, ok, fail } from '@/shared/kernel/Result'
import { StartOAuth, StartOAuthCommand } from '@/contexts/credentials/application/ports/in/StartOAuth'
import { OAuthConfigProvider } from '@/contexts/credentials/application/ports/out/OAuthConfigProvider'
import { OAuthClient } from '@/contexts/credentials/application/ports/out/OAuthClient'
import { StateSigner } from '@/contexts/credentials/application/ports/out/StateSigner'

// Application service. Looks up the plugin's OAuth2 endpoints (ACL), binds the
// caller's client id/secret into a signed `state`, and asks the OAuthClient to
// assemble the authorization URL. The redirect URI is the callback route mounted
// in main; `baseUrl` is injected (no env access in the application layer).
export class StartOAuthService implements StartOAuth {
  constructor(
    private readonly config: OAuthConfigProvider,
    private readonly signer: StateSigner,
    private readonly oauth: OAuthClient,
    private readonly baseUrl: string,
  ) {}

  async execute(cmd: StartOAuthCommand): Promise<Result<{ url: string }>> {
    const config = await this.config.get(cmd.pluginName)
    if (!config || !config.authUrl || !config.tokenUrl) {
      return fail('Plugin does not support OAuth2')
    }

    const state = this.signer.sign({
      pluginName: cmd.pluginName,
      userId: cmd.userId,
      clientId: cmd.clientId,
      clientSecret: cmd.clientSecret,
    })

    const redirectUri = `${this.baseUrl}/api/credentials/oauth2/callback`
    const url = this.oauth.generateAuthUrl(
      {
        authUrl: config.authUrl,
        tokenUrl: config.tokenUrl,
        clientId: cmd.clientId,
        clientSecret: cmd.clientSecret,
        scopes: config.scope,
        redirectUri,
        tokenAuthMethod: config.tokenAuthMethod,
      },
      state,
    )

    return ok({ url })
  }
}
