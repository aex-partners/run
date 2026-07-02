import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import {
  CompleteOAuth,
  CompleteOAuthCommand,
} from '@/contexts/credentials/application/ports/in/CompleteOAuth'
import { CredentialRepository } from '@/contexts/credentials/application/ports/out/CredentialRepository'
import { OAuthConfigProvider } from '@/contexts/credentials/application/ports/out/OAuthConfigProvider'
import { OAuthClient } from '@/contexts/credentials/application/ports/out/OAuthClient'
import { StateSigner } from '@/contexts/credentials/application/ports/out/StateSigner'
import { Credential } from '@/contexts/credentials/domain/Credential'
import { OAuth2Token } from '@/contexts/credentials/domain/OAuth2Token'

// Application service driven by the HTTP callback route. Verifies the signed
// state (rejecting forged/tampered callbacks), exchanges the code for tokens, and
// persists a fresh oauth2 credential owned by the user the state names. Network
// faults from the token exchange are turned into a Result failure so the callback
// route can render a clean error rather than a 500.
export class CompleteOAuthService implements CompleteOAuth {
  constructor(
    private readonly credentials: CredentialRepository,
    private readonly config: OAuthConfigProvider,
    private readonly signer: StateSigner,
    private readonly oauth: OAuthClient,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly baseUrl: string,
  ) {}

  async execute(cmd: CompleteOAuthCommand): Promise<Result<{ credentialId: string; pluginName: string }>> {
    const payload = this.signer.verify(cmd.state)
    if (!payload) return fail('Invalid or tampered OAuth state parameter')

    const config = await this.config.get(payload.pluginName)
    if (!config || !config.authUrl || !config.tokenUrl) {
      return fail(`Plugin "${payload.pluginName}" not found or has no OAuth2 config`)
    }

    const redirectUri = `${this.baseUrl}/api/credentials/oauth2/callback`
    const tokenAuthMethod = config.tokenAuthMethod ?? 'body'

    let tokens
    try {
      tokens = await this.oauth.exchangeCode(
        {
          authUrl: config.authUrl,
          tokenUrl: config.tokenUrl,
          clientId: payload.clientId,
          clientSecret: payload.clientSecret,
          redirectUri,
          tokenAuthMethod,
        },
        cmd.code,
      )
    } catch (err) {
      return fail(`OAuth token exchange failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    const value = OAuth2Token.buildValue({
      tokens,
      clientId: payload.clientId,
      clientSecret: payload.clientSecret,
      tokenUrl: config.tokenUrl,
      scope: config.scope,
      redirectUri,
      tokenAuthMethod,
      claimedAtSeconds: Math.floor(this.clock.now().getTime() / 1000),
    })

    const id = this.credentials.nextId()
    const credential = Credential.create({
      id,
      name: `${config.displayName ?? payload.pluginName} (OAuth2)`,
      pluginName: payload.pluginName,
      type: 'oauth2',
      value,
      createdBy: payload.userId,
      now: this.clock.now(),
    })
    if (!credential.ok) return fail(credential.error)

    await this.credentials.save(credential.value)
    await this.events.publish(credential.value.pullEvents())

    return ok({ credentialId: id.value, pluginName: payload.pluginName })
  }
}
