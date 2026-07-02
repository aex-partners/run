import { Result, ok, fail } from '@/shared/kernel/Result'
import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'
import {
  GetOAuthConfig,
  GetOAuthConfigCommand,
  OAuthConfig,
} from '@/contexts/plugins/application/ports/in/GetOAuthConfig'
import { PieceRegistry } from '@/contexts/plugins/application/ports/out/PieceRegistry'

// Read-side service behind the GetOAuthConfig in-port. Source
// `pieces/oauth2-handler.ts` `getPluginOAuthConfig`: find the catalog entry for
// the piece and project its `auth` props (authUrl / tokenUrl / scope /
// tokenAuthMethod) onto the pure OAuthConfig. Reads through the PieceRegistry
// out-port; the OAuth details live in each entry's verbatim `raw` JSON.
export class GetOAuthConfigService implements GetOAuthConfig {
  constructor(private readonly registry: PieceRegistry) {}

  async execute(cmd: GetOAuthConfigCommand): Promise<Result<OAuthConfig | null>> {
    if (!cmd.pieceName) return fail('GetOAuthConfig: pieceName is required')

    const entries = await this.registry.listCatalog()
    const entry = entries.find((e) => e.pieceName === cmd.pieceName)
    if (!entry || entry.authType !== 'oauth2') return ok(null)

    const auth = readAuth(entry.raw)
    if (!auth) return ok(null)

    const authUrl = asString(auth['authUrl'])
    const tokenUrl = asString(auth['tokenUrl'])
    if (!authUrl || !tokenUrl) return ok(null)

    const config: OAuthConfig = { authUrl, tokenUrl }
    const scope = normalizeScope(auth['scope'])
    if (scope !== undefined) config.scope = scope
    const tokenAuthMethod = asString(auth['tokenAuthMethod'])
    if (tokenAuthMethod !== undefined) config.tokenAuthMethod = tokenAuthMethod
    const displayName = asString(entry.name)
    if (displayName !== undefined) config.displayName = displayName

    return ok(config)
  }
}

// ---- pure JSON navigation helpers (no npm, no framework) ----

function readAuth(raw: Json): JsonObject | null {
  if (!isJsonObject(raw)) return null
  const auth = raw['auth']
  return auth !== undefined && isJsonObject(auth) ? auth : null
}

function asString(value: Json | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

// The piece may declare scope as a single string or a string[]; collapse to the
// space-delimited string the OAuthConfig contract uses.
function normalizeScope(value: Json | undefined): string | undefined {
  if (typeof value === 'string') return value.length > 0 ? value : undefined
  if (Array.isArray(value)) {
    const parts = value.filter((x): x is string => typeof x === 'string')
    return parts.length > 0 ? parts.join(' ') : undefined
  }
  return undefined
}
