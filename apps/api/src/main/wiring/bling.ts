// Wiring for the `bling` context. Read-only access to the Bling ERP (produtos /
// pedidos de venda / contatos) via the Bling API v3, connected as an OAuth2 piece.
// ACL bridge:
//   * ResolveCredential -> credentials ResolveCredential in-port. The Bling OAuth2
//     token is resolved by plugin name "bling"; the credentials context stores and
//     AUTO-REFRESHES it, so this context just reads the decrypted access_token and
//     never runs its own OAuth flow.
// Builds the Bling v3 client, the two use-cases and the tRPC controller. Exposes
// the in-ports so the assistant tool assembly and routes can reach them.
import { Infra } from '@/main/wiring/infra'

import { ResolveCredential as CredentialsResolveCredential } from '@/contexts/credentials/application/ports/in/ResolveCredential'

import { BlingApiV3Client } from '@/contexts/bling/adapters/out/http/BlingApiV3Client'
import { ListBlingResourceService } from '@/contexts/bling/application/use-cases/ListBlingResourceService'
import { GetBlingRecordService } from '@/contexts/bling/application/use-cases/GetBlingRecordService'
import { blingController } from '@/contexts/bling/adapters/in/http/BlingController'
import { ResolveCredential as BlingResolveCredential } from '@/contexts/bling/application/ports/out/ResolveCredential'

type BlingDeps = {
  resolveCredential: CredentialsResolveCredential
}

export function wireBling(_infra: Infra, deps: BlingDeps) {
  const { resolveCredential } = deps

  const client = new BlingApiV3Client()

  // ACL bridge: bling ResolveCredential -> credentials ResolveCredential in-port
  // (resolves the "bling" OAuth2 token bag).
  const blingResolveCredential: BlingResolveCredential = {
    resolve: (req) => resolveCredential.execute(req),
  }

  const listBlingResource = new ListBlingResourceService(blingResolveCredential, client)
  const getBlingRecord = new GetBlingRecordService(blingResolveCredential, client)

  const blingCtl = blingController({ list: listBlingResource, get: getBlingRecord })

  return {
    controller: blingCtl,
    ports: { listBlingResource, getBlingRecord },
  }
}

export type BlingWiring = ReturnType<typeof wireBling>
