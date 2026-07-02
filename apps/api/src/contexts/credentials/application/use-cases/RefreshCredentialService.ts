import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import {
  RefreshCredential,
  RefreshCredentialCommand,
} from '@/contexts/credentials/application/ports/in/RefreshCredential'
import { CredentialRepository } from '@/contexts/credentials/application/ports/out/CredentialRepository'
import { OAuthClient } from '@/contexts/credentials/application/ports/out/OAuthClient'
import { TokenCache } from '@/contexts/credentials/application/ports/out/TokenCache'
import { CredentialId } from '@/contexts/credentials/domain/ids'
import { OAuth2Token } from '@/contexts/credentials/domain/OAuth2Token'

// Application service. The imperative shell around the PURE OAuth2 lifecycle
// rules: it decides which credentials to consider (one id, or all oauth2 ids for
// the scheduled job), asks the domain whether each token `needsRefresh`, performs
// the refresh through the OAuthClient out-port, and folds the result back via the
// aggregate. A failed refresh flips the credential to `error` (so resolution
// skips it) instead of throwing. Mirrors the source `refreshPluginCredential`.
export class RefreshCredentialService implements RefreshCredential {
  constructor(
    private readonly credentials: CredentialRepository,
    private readonly oauth: OAuthClient,
    private readonly cache: TokenCache,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: RefreshCredentialCommand): Promise<Result<{ total: number; refreshed: number }>> {
    const ids = cmd.credentialId ? [cmd.credentialId] : await this.credentials.listOAuth2Ids()

    let refreshed = 0
    for (const id of ids) {
      try {
        if (await this.refreshOne(id)) refreshed++
      } catch {
        // Per-credential isolation: one bad token can't abort the batch.
      }
    }

    return ok({ total: ids.length, refreshed })
  }

  // Returns true when the credential ends up holding a usable (fresh or still
  // valid) token. Non-oauth2 / un-refreshable credentials return false.
  private async refreshOne(id: string): Promise<boolean> {
    const credential = await this.credentials.findById(CredentialId.of(id))
    if (!credential || credential.type !== 'oauth2') return false

    const token = OAuth2Token.parse(credential.value)
    if (!OAuth2Token.canRefresh(token)) return false

    const now = this.clock.now()
    if (!OAuth2Token.needsRefresh(token, now)) return true // still valid (with skew)

    try {
      const tokens = await this.oauth.refreshAccessToken(
        {
          authUrl: '',
          tokenUrl: token.tokenUrl,
          clientId: token.clientId,
          clientSecret: token.clientSecret,
          redirectUri: '',
          tokenAuthMethod: token.tokenAuthMethod,
        },
        token.refreshToken,
      )

      const value = OAuth2Token.applyRefresh(credential.value, tokens, Math.floor(now.getTime() / 1000))
      credential.applyRefreshedTokens(value, now)
      await this.credentials.save(credential)
      this.cache.invalidate(id)
      await this.events.publish(credential.pullEvents())
      return true
    } catch {
      credential.markRefreshError(now)
      await this.credentials.save(credential)
      this.cache.invalidate(id)
      await this.events.publish(credential.pullEvents())
      return false
    }
  }
}
