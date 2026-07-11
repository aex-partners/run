// Wiring for the `costing` context (ficha técnica explosion + cost snapshots).
// No cross-context construction-time infra deps: it only needs the data context's
// in-ports, bridged through two ACL adapters.
// ACL bridges:
//   * EntityRegistry -> data ListEntities (resolve entity id by slug).
//   * RecordStore    -> data ListEntities/QueryRecords/GetRecord/InsertRecord/
//                       UpdateRecord/DeleteRecord (CRUD over the dynamic records,
//                       keyed by entityId; the bridge resolves entityId -> slug).
// Builds the four use-cases and the tRPC controller. Exposes the in-ports so the
// assistant tool assembly and routes can reach them.
import { Infra } from '@/main/wiring/infra'
import { DataWiring } from '@/main/wiring/data'

import { DataEntityRegistry } from '@/contexts/costing/adapters/out/bridge/DataEntityRegistry'
import { DataRecordStore } from '@/contexts/costing/adapters/out/bridge/DataRecordStore'
import { RoteiroProvider } from '@/contexts/costing/application/ports/out/RoteiroProvider'
import { ExplodirFichaService } from '@/contexts/costing/application/use-cases/ExplodirFichaService'
import { RecalcularCustoService } from '@/contexts/costing/application/use-cases/RecalcularCustoService'
import { PublicarRevisaoService } from '@/contexts/costing/application/use-cases/PublicarRevisaoService'
import { HistoricoCustoService } from '@/contexts/costing/application/use-cases/HistoricoCustoService'
import { costingController } from '@/contexts/costing/adapters/in/http/CostingController'

type CostingDeps = {
  // The SAME real data in-ports the AI ToolBox and other contexts consume; the
  // bridges satisfy their local `*Like` shapes against these structurally.
  data: Pick<
    DataWiring['ports'],
    'listEntities' | 'queryRecords' | 'getRecord' | 'insertRecord' | 'updateRecord' | 'deleteRecord'
  >
}

export function wireCosting(_infra: Infra, deps: CostingDeps) {
  const { data } = deps

  // ACL bridge: costing EntityRegistry -> data ListEntities.
  const registry = new DataEntityRegistry({ listEntities: data.listEntities })
  // ACL bridge: costing RecordStore -> data ListEntities/QueryRecords/GetRecord/
  // InsertRecord/UpdateRecord/DeleteRecord.
  const store = new DataRecordStore({
    listEntities: data.listEntities,
    query: data.queryRecords,
    get: data.getRecord,
    insert: data.insertRecord,
    update: data.updateRecord,
    delete: data.deleteRecord,
  })

  // TODO(Task 10): trocar por `new ManufacturingRoteiroProvider({ obterRoteiro })` assim que o
  // manufacturing tiver wiring. Até lá o costing roda sem roteiro: a conversão fica vazia e a
  // explosão reporta 'sem roteiro publicado' em `erros` (soft failure — o custo de MATERIAIS
  // continua sendo calculado e gravado, exatamente como antes desta task).
  const roteiro: RoteiroProvider = { async roteiroPublicado() { return null } }

  const explodirFicha = new ExplodirFichaService(store, registry, roteiro)
  const recalcularCusto = new RecalcularCustoService(explodirFicha, store, registry)
  const publicarRevisao = new PublicarRevisaoService(store, registry)
  const historicoCusto = new HistoricoCustoService(store, registry)

  const controller = costingController({ explodirFicha, recalcularCusto, publicarRevisao, historicoCusto })

  return {
    controller,
    ports: { explodirFicha, recalcularCusto, publicarRevisao, historicoCusto },
  }
}

export type CostingWiring = ReturnType<typeof wireCosting>
