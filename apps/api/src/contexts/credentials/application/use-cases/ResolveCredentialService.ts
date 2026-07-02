import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { JsonObject } from '@/shared/domain/Json'
import {
  ResolveCredential,
  ResolveCredentialQuery,
} from '@/contexts/credentials/application/ports/in/ResolveCredential'
import { RefreshCredential } from '@/contexts/credentials/application/ports/in/RefreshCredential'
import { CredentialRepository } from '@/contexts/credentials/application/ports/out/CredentialRepository'
import { TokenCache } from '@/contexts/credentials/application/ports/out/TokenCache'
import { CredentialId } from '@/contexts/credentials/domain/ids'
import { CredentialResolution } from '@/contexts/credentials/domain/CredentialResolution'
import { OAuth2Token } from '@/contexts/credentials/domain/OAuth2Token'

// Application service behind the ResolveCredential ACL in-port. Picks the
// credential per the PURE precedence rule (explicit > primary > oldest), then
// returns its decrypted value — serving from the short-TTL TokenCache when warm
// and auto-refreshing a near-expiry OAuth token (delegating to RefreshCredential)
// before caching. Mirrors the source `resolveCredential` / `resolveById`.
export class ResolveCredentialService implements ResolveCredential {
  constructor(
    private readonly credentials: CredentialRepository,
    private readonly refresh: RefreshCredential,
    private readonly cache: TokenCache,
    private readonly clock: Clock,
  ) {}

  async execute(query: ResolveCredentialQuery): Promise<Result<JsonObject | null>> {
    const chosenId = await this.chooseId(query)
    if (!chosenId) return ok(null)

    const cached = this.cache.get(chosenId)
    if (cached) return ok(cached)

    let credential = await this.credentials.findById(CredentialId.of(chosenId))
    if (!credential) return ok(null)

    if (credential.type === 'oauth2') {
      const token = OAuth2Token.parse(credential.value)
      if (OAuth2Token.canRefresh(token) && OAuth2Token.needsRefresh(token, this.clock.now())) {
        await this.refresh.execute({ credentialId: chosenId })
        credential = await this.credentials.findById(CredentialId.of(chosenId))
        if (!credential) return ok(null)
      }
      // Cache only OAuth values, per the credential contract.
      this.cache.set(chosenId, credential.value)
    }

    return ok(credential.value)
  }

  // Explicit id wins outright (loaded directly, unscoped — matches the source).
  // Otherwise the PURE selector picks among the plugin's active candidates.
  private async chooseId(query: ResolveCredentialQuery): Promise<string | null> {
    if (query.credentialId) return query.credentialId
    const candidates = await this.credentials.findActiveCandidatesByPlugin(query.pluginName)
    return CredentialResolution.select(candidates, null)?.id ?? null
  }
}
