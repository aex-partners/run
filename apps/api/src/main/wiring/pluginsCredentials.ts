// Wiring for the `credentials` + `plugins` pair. They are built together because
// their two ACL bridges form a closed loop within the pair: credentials'
// OAuthConfigProvider reads plugins' GetOAuthConfig (piece OAuth endpoints), and
// plugins' ResolveCredential reads credentials' ResolveCredential in-port. Keeping
// them in one builder lets the late-bound `oauthCfgSvc` holder stay local instead of
// leaking into the composition root. Exposes the piece invokers (automation bridges
// to them), the credential refresher (worker) and the refresh scheduler.
import { createHash } from 'node:crypto'
import { Infra } from '@/main/wiring/infra'

import { AesCredentialCipher } from '@/contexts/credentials/adapters/out/crypto/AesCredentialCipher'
import { AesStateSigner } from '@/contexts/credentials/adapters/out/crypto/AesStateSigner'
import { FetchOAuthClient } from '@/contexts/credentials/adapters/out/oauth/FetchOAuthClient'
import { InMemoryTokenCache } from '@/contexts/credentials/adapters/out/cache/InMemoryTokenCache'
import { BullCredentialsRefreshScheduler } from '@/contexts/credentials/adapters/out/queue/BullCredentialsRefreshScheduler'
import { DrizzleCredentialRepository } from '@/contexts/credentials/adapters/out/persistence/DrizzleCredentialRepository'
import { DrizzleListCredentials } from '@/contexts/credentials/adapters/out/persistence/DrizzleListCredentials'
import { CreateCredentialService } from '@/contexts/credentials/application/use-cases/CreateCredentialService'
import { UpdateCredentialService } from '@/contexts/credentials/application/use-cases/UpdateCredentialService'
import { DeleteCredentialService } from '@/contexts/credentials/application/use-cases/DeleteCredentialService'
import { RefreshCredentialService } from '@/contexts/credentials/application/use-cases/RefreshCredentialService'
import { ResolveCredentialService } from '@/contexts/credentials/application/use-cases/ResolveCredentialService'
import { StartOAuthService } from '@/contexts/credentials/application/use-cases/StartOAuthService'
import { CompleteOAuthService } from '@/contexts/credentials/application/use-cases/CompleteOAuthService'
import { credentialController, makeCredentialOAuthCallback } from '@/contexts/credentials/adapters/in/http/CredentialController'
import { OAuthConfigProvider } from '@/contexts/credentials/application/ports/out/OAuthConfigProvider'

import { DrizzlePluginRepository } from '@/contexts/plugins/adapters/out/persistence/DrizzlePluginRepository'
import { DrizzleListPlugins } from '@/contexts/plugins/adapters/out/persistence/DrizzleListPlugins'
import { DrizzleGetPlugin } from '@/contexts/plugins/adapters/out/persistence/DrizzleGetPlugin'
import { DrizzleGetConfigSchema } from '@/contexts/plugins/adapters/out/persistence/DrizzleGetConfigSchema'
import { NpmPieceInstaller } from '@/contexts/plugins/adapters/out/installer/NpmPieceInstaller'
import { ActivepiecesPieceRegistry } from '@/contexts/plugins/adapters/out/registry/ActivepiecesPieceRegistry'
import { ActivepiecesPieceClient } from '@/contexts/plugins/adapters/out/framework/ActivepiecesPieceClient'
import { DrizzlePluginStoreRepository } from '@/contexts/plugins/adapters/out/persistence/DrizzlePluginStoreRepository'
import { ConfigurePluginService } from '@/contexts/plugins/application/use-cases/ConfigurePluginService'
import { InstallPluginService } from '@/contexts/plugins/application/use-cases/InstallPluginService'
import { InvokePieceService } from '@/contexts/plugins/application/use-cases/InvokePieceService'
import { ResolvePieceActionService } from '@/contexts/plugins/application/use-cases/ResolvePieceActionService'
import { SetPluginEnabledService } from '@/contexts/plugins/application/use-cases/SetPluginEnabledService'
import { SyncRegistryService } from '@/contexts/plugins/application/use-cases/SyncRegistryService'
import { UninstallPluginService } from '@/contexts/plugins/application/use-cases/UninstallPluginService'
import { GetPieceCatalogService } from '@/contexts/plugins/application/queries/GetPieceCatalogService'
import { ListPieceToolsService } from '@/contexts/plugins/application/queries/ListPieceToolsService'
import { GetPieceMetadataService } from '@/contexts/plugins/application/queries/GetPieceMetadataService'
import { ActivepiecesCloudClient } from '@/contexts/plugins/adapters/out/cloud/ActivepiecesCloudClient'
import { pluginController } from '@/contexts/plugins/adapters/in/http/PluginController'
import { ResolveCredential as PluginsResolveCredential } from '@/contexts/plugins/application/ports/out/ResolveCredential'
import { InvokePieceTriggerService } from '@/contexts/plugins/application/use-cases/InvokePieceTriggerService'
import { GetOAuthConfigService } from '@/contexts/plugins/application/use-cases/GetOAuthConfigService'
import { GetOAuthConfig } from '@/contexts/plugins/application/ports/in/GetOAuthConfig'

export function wirePluginsCredentials(infra: Infra) {
  const { db, env, events, clock, redisUrl, encryptionKey } = infra

  // Late-bound within the pair: plugins fulfills this after the credentials OAuth
  // bridge has closed over it (the bridge reads it at runtime, not at build time).
  let oauthCfgSvc: GetOAuthConfig | undefined

  // ----- credentials
  const credCipher = new AesCredentialCipher(encryptionKey)
  const credRepo = new DrizzleCredentialRepository(db, credCipher)
  const listCredentials = new DrizzleListCredentials(db)
  const oauthClient = new FetchOAuthClient()
  // AES-256-GCM signer: the OAuth `state` carries a client secret, so it is
  // encrypted (confidential) and authenticated (tamper-evident), not merely
  // HMAC-signed. Key = ENCRYPTION_KEY when set, else derived from
  // BETTER_AUTH_SECRET (sha256 -> 64 hex chars) so it works without extra config.
  const stateSignerKey =
    env.ENCRYPTION_KEY ?? createHash('sha256').update(env.BETTER_AUTH_SECRET).digest('hex')
  const stateSigner = new AesStateSigner(stateSignerKey)
  const tokenCache = new InMemoryTokenCache()
  // ACL bridge: credentials OAuthConfigProvider -> plugins GetOAuthConfig (the
  // piece catalog owns the OAuth endpoints). Unwraps Result, splits the
  // space-joined scope, and narrows tokenAuthMethod to the credentials shape.
  const oauthConfigProvider: OAuthConfigProvider = {
    get: async (pluginName) => {
      if (!oauthCfgSvc) return null
      const r = await oauthCfgSvc.execute({ pieceName: pluginName })
      if (!r.ok || r.value === null) return null
      const c = r.value
      const tam = c.tokenAuthMethod === 'basic' ? 'basic' : c.tokenAuthMethod === 'body' ? 'body' : undefined
      return {
        authUrl: c.authUrl,
        tokenUrl: c.tokenUrl,
        scope: c.scope ? c.scope.split(' ').filter(Boolean) : undefined,
        tokenAuthMethod: tam,
        displayName: c.displayName,
      }
    },
  }
  const credScheduler = new BullCredentialsRefreshScheduler(redisUrl)
  const createCredential = new CreateCredentialService(credRepo, events, clock)
  const updateCredential = new UpdateCredentialService(credRepo, tokenCache, events, clock)
  const deleteCredential = new DeleteCredentialService(credRepo, tokenCache, events, clock)
  const refreshCredential = new RefreshCredentialService(credRepo, oauthClient, tokenCache, events, clock)
  const resolveCredential = new ResolveCredentialService(credRepo, refreshCredential, tokenCache, clock)
  const startOAuth = new StartOAuthService(oauthConfigProvider, stateSigner, oauthClient, env.BETTER_AUTH_URL)
  const completeOAuth = new CompleteOAuthService(credRepo, oauthConfigProvider, stateSigner, oauthClient, events, clock, env.BETTER_AUTH_URL)
  const credentialsCtl = credentialController({ list: listCredentials, create: createCredential, update: updateCredential, remove: deleteCredential, startOAuth })
  const credentialOAuthCallback = makeCredentialOAuthCallback({ complete: completeOAuth })

  // ----- plugins
  const pluginRepo = new DrizzlePluginRepository(db)
  const pieceRegistry = new ActivepiecesPieceRegistry()
  // The list read-model enriches rows with each piece's auth field-schema
  // (`authProps`) from the catalog, so the Connect dialog can render dynamic fields.
  const listPlugins = new DrizzleListPlugins(db, pieceRegistry)
  const getPlugin = new DrizzleGetPlugin(db)
  const getConfigSchema = new DrizzleGetConfigSchema(db)
  const pieceInstaller = new NpmPieceInstaller()
  const pluginStoreRepo = new DrizzlePluginStoreRepository(db)
  // Real framework-backed runner: loads the piece from .pieces/ and runs
  // action.run / trigger hooks (degrades gracefully to a fail when a piece is
  // absent). The offline demo keeps its own StubPieceClient.
  const pieceClient = new ActivepiecesPieceClient(pluginStoreRepo, clock)
  // ACL bridge: plugins ResolveCredential -> credentials ResolveCredential in-port.
  const pluginsResolveCredential: PluginsResolveCredential = {
    resolve: (req) => resolveCredential.execute(req),
  }
  const configurePlugin = new ConfigurePluginService(pluginRepo, events, clock)
  const installPlugin = new InstallPluginService(pluginRepo, pieceInstaller, events, clock)
  const invokePiece = new InvokePieceService(pieceClient)
  void invokePiece
  const resolvePieceAction = new ResolvePieceActionService(pieceRegistry, pluginsResolveCredential, pieceClient)
  const invokePieceTrigger = new InvokePieceTriggerService(pieceRegistry, pieceClient)
  oauthCfgSvc = new GetOAuthConfigService(pieceRegistry) // fulfills credentials' oauthConfigProvider holder
  const setPluginEnabled = new SetPluginEnabledService(pluginRepo, events, clock)
  const syncRegistry = new SyncRegistryService(pluginRepo, pieceRegistry, clock)
  const uninstallPlugin = new UninstallPluginService(pluginRepo, pieceInstaller, events, clock)
  const getPieceCatalog = new GetPieceCatalogService(pieceRegistry)
  const listPieceTools = new ListPieceToolsService(pluginRepo, pieceRegistry)
  const remotePieceCatalog = new ActivepiecesCloudClient()
  const getPieceMetadata = new GetPieceMetadataService(remotePieceCatalog)
  const pluginsCtl = pluginController({
    list: listPlugins, getById: getPlugin, catalog: getPieceCatalog, install: installPlugin,
    uninstall: uninstallPlugin, configure: configurePlugin, setEnabled: setPluginEnabled,
    syncRegistry, listPieceTools, getConfigSchema, pieceMetadata: getPieceMetadata,
  })

  return {
    controllers: { credentials: credentialsCtl, plugins: pluginsCtl },
    http: { credentialOAuthCallback },
    ports: { refreshCredential, resolvePieceAction, invokePieceTrigger, resolveCredential },
    schedulers: { credScheduler },
  }
}

export type PluginsCredentialsWiring = ReturnType<typeof wirePluginsCredentials>
