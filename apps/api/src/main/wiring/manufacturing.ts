// Wiring for the `manufacturing` context (centros de trabalho + roteiro de produção).
// No cross-context construction-time infra deps: it only needs the data context's
// in-ports, bridged through two ACL adapters.
// ACL bridges:
//   * EntityRegistry -> data ListEntities (resolve entity id by slug).
//   * RecordStore    -> data ListEntities/QueryRecords/GetRecord/InsertRecord/
//                       UpdateRecord/DeleteRecord (CRUD over the dynamic records,
//                       keyed by entityId; the bridge resolves entityId -> slug).
// Builds the five use-cases and the tRPC controller. Exposes the in-ports so the
// assistant tool assembly, routes AND the costing wiring can reach them: costing's
// ManufacturingRoteiroProvider bridge is fed `obterRoteiro` from here, which is why
// this builder must run BEFORE wireCosting in the composition root.
import { Infra } from '@/main/wiring/infra'
import { DataWiring } from '@/main/wiring/data'

import { DataEntityRegistry } from '@/contexts/manufacturing/adapters/out/bridge/DataEntityRegistry'
import { DataRecordStore } from '@/contexts/manufacturing/adapters/out/bridge/DataRecordStore'
import { ObterRoteiroService } from '@/contexts/manufacturing/application/use-cases/ObterRoteiroService'
import { DefinirCentroService } from '@/contexts/manufacturing/application/use-cases/DefinirCentroService'
import { ListarCentrosService } from '@/contexts/manufacturing/application/use-cases/ListarCentrosService'
import { DefinirOperacaoService } from '@/contexts/manufacturing/application/use-cases/DefinirOperacaoService'
import { PublicarRoteiroService } from '@/contexts/manufacturing/application/use-cases/PublicarRoteiroService'
import { manufacturingController } from '@/contexts/manufacturing/adapters/in/http/ManufacturingController'

type ManufacturingDeps = {
  // The SAME real data in-ports the AI ToolBox and the costing wiring consume; the
  // bridges satisfy their local `*Like` shapes against these structurally.
  data: Pick<
    DataWiring['ports'],
    'listEntities' | 'queryRecords' | 'getRecord' | 'insertRecord' | 'updateRecord' | 'deleteRecord'
  >
}

export function wireManufacturing(_infra: Infra, deps: ManufacturingDeps) {
  const { data } = deps

  // ACL bridge: manufacturing EntityRegistry -> data ListEntities.
  const registry = new DataEntityRegistry({ listEntities: data.listEntities })
  // ACL bridge: manufacturing RecordStore -> data ListEntities/QueryRecords/GetRecord/
  // InsertRecord/UpdateRecord/DeleteRecord.
  const store = new DataRecordStore({
    listEntities: data.listEntities,
    query: data.queryRecords,
    get: data.getRecord,
    insert: data.insertRecord,
    update: data.updateRecord,
    delete: data.deleteRecord,
  })

  const obterRoteiro = new ObterRoteiroService(store, registry)
  const definirCentro = new DefinirCentroService(store, registry)
  const listarCentros = new ListarCentrosService(store, registry)
  const definirOperacao = new DefinirOperacaoService(store, registry)
  const publicarRoteiro = new PublicarRoteiroService(store, registry)

  const controller = manufacturingController({
    obterRoteiro, definirCentro, listarCentros, definirOperacao, publicarRoteiro,
  })

  return {
    controller,
    ports: { obterRoteiro, definirCentro, listarCentros, definirOperacao, publicarRoteiro },
  }
}

export type ManufacturingWiring = ReturnType<typeof wireManufacturing>
