// Wiring for the `costing` context (ficha técnica explosion + cost snapshots).
// No cross-context construction-time infra deps: it only needs the data context's
// in-ports, bridged through two ACL adapters.
// ACL bridges:
//   * EntityRegistry -> data ListEntities (resolve entity id by slug).
//   * RecordStore    -> data ListEntities/QueryRecords/GetRecord/InsertRecord/
//                       UpdateRecord/DeleteRecord (CRUD over the dynamic records,
//                       keyed by entityId; the bridge resolves entityId -> slug).
//   * RoteiroProvider -> manufacturing ObterRoteiro (the published roteiro that
//                       drives the CONVERSION cost: MOD + indireto).
// Builds the six use-cases and the tRPC controller. Exposes the in-ports so the
// assistant tool assembly and routes can reach them.
import { Infra } from '@/main/wiring/infra'
import { DataWiring } from '@/main/wiring/data'
import { ManufacturingWiring } from '@/main/wiring/manufacturing'

import { DataEntityRegistry } from '@/contexts/costing/adapters/out/bridge/DataEntityRegistry'
import { DataRecordStore } from '@/contexts/costing/adapters/out/bridge/DataRecordStore'
import { ManufacturingRoteiroProvider } from '@/contexts/costing/adapters/out/bridge/ManufacturingRoteiroProvider'
import { ExplodirFichaService } from '@/contexts/costing/application/use-cases/ExplodirFichaService'
import { RecalcularCustoService } from '@/contexts/costing/application/use-cases/RecalcularCustoService'
import { PublicarRevisaoService } from '@/contexts/costing/application/use-cases/PublicarRevisaoService'
import { HistoricoCustoService } from '@/contexts/costing/application/use-cases/HistoricoCustoService'
import { DefinirTaxaCustoService } from '@/contexts/costing/application/use-cases/DefinirTaxaCustoService'
import { CustoUnitarioService } from '@/contexts/costing/application/use-cases/CustoUnitarioService'
import { costingController } from '@/contexts/costing/adapters/in/http/CostingController'

type CostingDeps = {
  // The SAME real data in-ports the AI ToolBox and other contexts consume; the
  // bridges satisfy their local `*Like` shapes against these structurally.
  data: Pick<
    DataWiring['ports'],
    'listEntities' | 'queryRecords' | 'getRecord' | 'insertRecord' | 'updateRecord' | 'deleteRecord'
  >
  // manufacturing's ObterRoteiro in-port: the ONLY thing costing needs from that
  // context (via the ManufacturingRoteiroProvider ACL bridge). This is why the
  // composition root builds wireManufacturing BEFORE wireCosting.
  manufacturing: Pick<ManufacturingWiring['ports'], 'obterRoteiro'>
}

export function wireCosting(_infra: Infra, deps: CostingDeps) {
  const { data, manufacturing } = deps

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

  // ACL bridge: costing RoteiroProvider -> manufacturing ObterRoteiro. A explosão lê
  // daqui o roteiro PUBLICADO do modelo e custeia a conversão (MOD + indireto). Modelo
  // sem revisão publicada devolve null: soft failure, o custo de MATERIAIS continua
  // válido e a explosão reporta 'sem roteiro publicado' em `erros`.
  const roteiro = new ManufacturingRoteiroProvider({ obterRoteiro: manufacturing.obterRoteiro })

  const explodirFicha = new ExplodirFichaService(store, registry, roteiro)
  const recalcularCusto = new RecalcularCustoService(explodirFicha, store, registry)
  const publicarRevisao = new PublicarRevisaoService(store, registry)
  const historicoCusto = new HistoricoCustoService(store, registry)
  const definirTaxaCusto = new DefinirTaxaCustoService(store, registry)
  const custoUnitario = new CustoUnitarioService(store, registry)

  const controller = costingController({
    explodirFicha, recalcularCusto, publicarRevisao, historicoCusto,
    definirTaxa: definirTaxaCusto, custoUnitario,
  })

  return {
    controller,
    ports: {
      explodirFicha, recalcularCusto, publicarRevisao, historicoCusto, definirTaxaCusto, custoUnitario,
    },
  }
}

export type CostingWiring = ReturnType<typeof wireCosting>
