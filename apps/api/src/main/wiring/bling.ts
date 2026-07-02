// Wiring for the `bling` context. Read-only access to the Bling ERP (produtos /
// pedidos de venda / contatos) via the Bling API v3, connected as an OAuth2 piece,
// PLUS the full-mirror sync: pulls every mirror entity from Bling and reconciles
// it into the data/catalog context.
// ACL bridges:
//   * ResolveCredential -> credentials ResolveCredential in-port. The Bling OAuth2
//     token is resolved by plugin name "bling"; the credentials context stores and
//     AUTO-REFRESHES it, so this context just reads the decrypted access_token and
//     never runs its own OAuth flow.
//   * EntityCatalog -> data CreateEntity/AddField/DescribeEntity/ListEntities
//     (idempotently seeds the 17 mirror entities + their fields).
//   * RecordSink -> data InsertRecord/UpdateRecord/GetRecord (upserts mirrored
//     records keyed by their Bling external id via the bling_sync_map).
// Builds the Bling v3 clients (read-through + sync), the use-cases, the tRPC
// controller and the BullMQ sync scheduler. Exposes the in-ports so the assistant
// tool assembly, routes and worker can reach them.
import { Infra } from '@/main/wiring/infra'
import { DataWiring } from '@/main/wiring/data'

import { ResolveCredential as CredentialsResolveCredential } from '@/contexts/credentials/application/ports/in/ResolveCredential'

import { BlingApiV3Client } from '@/contexts/bling/adapters/out/http/BlingApiV3Client'
import { BlingSyncApiV3Client } from '@/contexts/bling/adapters/out/http/BlingSyncApiV3Client'
import { DrizzleBlingSyncMap } from '@/contexts/bling/adapters/out/persistence/DrizzleBlingSyncMap'
import { DrizzleResolveOwner } from '@/contexts/bling/adapters/out/persistence/DrizzleResolveOwner'
import { DataEntityCatalog } from '@/contexts/bling/adapters/out/bridge/DataEntityCatalog'
import { DataRecordSink } from '@/contexts/bling/adapters/out/bridge/DataRecordSink'
import { BullBlingSyncScheduler } from '@/contexts/bling/adapters/out/queue/BullBlingSyncScheduler'
import { ListBlingResourceService } from '@/contexts/bling/application/use-cases/ListBlingResourceService'
import { GetBlingRecordService } from '@/contexts/bling/application/use-cases/GetBlingRecordService'
import { SeedBlingEntitiesService } from '@/contexts/bling/application/use-cases/SeedBlingEntitiesService'
import { SyncBlingMirrorService } from '@/contexts/bling/application/use-cases/SyncBlingMirrorService'
import { FkCache } from '@/contexts/bling/application/mirror/FkCache'
import { blingController } from '@/contexts/bling/adapters/in/http/BlingController'
import { ResolveCredential as BlingResolveCredential } from '@/contexts/bling/application/ports/out/ResolveCredential'

type BlingDeps = {
  resolveCredential: CredentialsResolveCredential
  createEntity: DataWiring['ports']['createEntity']
  addField: DataWiring['ports']['addField']
  describeEntity: DataWiring['ports']['describeEntity']
  listEntities: DataWiring['ports']['listEntities']
  insertRecord: DataWiring['ports']['insertRecord']
  updateRecord: DataWiring['ports']['updateRecord']
  getRecord: DataWiring['ports']['getRecord']
}

export function wireBling(infra: Infra, deps: BlingDeps) {
  const {
    resolveCredential, createEntity, addField, describeEntity, listEntities,
    insertRecord, updateRecord, getRecord,
  } = deps

  const client = new BlingApiV3Client()

  // ACL bridge: bling ResolveCredential -> credentials ResolveCredential in-port
  // (resolves the "bling" OAuth2 token bag).
  const blingResolveCredential: BlingResolveCredential = {
    resolve: (req) => resolveCredential.execute(req),
  }

  const listBlingResource = new ListBlingResourceService(blingResolveCredential, client)
  const getBlingRecord = new GetBlingRecordService(blingResolveCredential, client)

  // ----- full-mirror sync -----
  const syncClient = new BlingSyncApiV3Client(blingResolveCredential)
  const syncMap = new DrizzleBlingSyncMap(infra.db, infra.clock)
  const resolveOwner = new DrizzleResolveOwner(infra.db)
  // ACL bridge: bling EntityCatalog -> data CreateEntity/AddField/DescribeEntity/ListEntities.
  const entityCatalog = new DataEntityCatalog({ createEntity, addField, describeEntity, listEntities })
  // ACL bridge: bling RecordSink -> data InsertRecord/UpdateRecord/GetRecord.
  const recordSink = new DataRecordSink({ insert: insertRecord, update: updateRecord, get: getRecord, syncMap, clock: infra.clock })
  const seed = new SeedBlingEntitiesService(entityCatalog)
  const syncBlingMirror = new SyncBlingMirrorService({
    seed, client: syncClient, recordSink, syncMap, resolveOwner, makeFk: () => new FkCache(),
  })
  const blingSyncScheduler = new BullBlingSyncScheduler(infra.redisUrl)

  const blingCtl = blingController({ list: listBlingResource, get: getBlingRecord, sync: syncBlingMirror })

  return {
    controller: blingCtl,
    ports: { listBlingResource, getBlingRecord, syncBlingMirror },
    schedulers: { blingSyncScheduler },
  }
}

export type BlingWiring = ReturnType<typeof wireBling>
