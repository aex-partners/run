// Wiring for the `manufacturing` context (centros de trabalho + roteiro de produção).
// No cross-context construction-time infra deps: it only needs the data context's
// in-ports, bridged through two ACL adapters.
// ACL bridges:
//   * EntityRegistry -> data ListEntities (resolve entity id by slug).
//   * RecordStore    -> data ListEntities/QueryRecords/GetRecord/InsertRecord/
//                       UpdateRecord/DeleteRecord (CRUD over the dynamic records,
//                       keyed by entityId; the bridge resolves entityId -> slug).
// Builds the six use-cases and the tRPC controller. Exposes the in-ports so the
// assistant tool assembly, routes AND the costing wiring can reach them: costing's
// ManufacturingRoteiroProvider bridge is fed `obterRoteiro` from here, which is why
// this builder must run BEFORE wireCosting in the composition root.
import { Infra } from '@/main/wiring/infra'
import { DataWiring } from '@/main/wiring/data'

import { DataEntityRegistry } from '@/contexts/manufacturing/adapters/out/bridge/DataEntityRegistry'
import { DataRecordStore } from '@/contexts/manufacturing/adapters/out/bridge/DataRecordStore'
import { DrizzleResolveOwner } from '@/contexts/manufacturing/adapters/out/persistence/DrizzleResolveOwner'
import { ObterRoteiroService } from '@/contexts/manufacturing/application/use-cases/ObterRoteiroService'
import { DefinirCentroService } from '@/contexts/manufacturing/application/use-cases/DefinirCentroService'
import { ListarCentrosService } from '@/contexts/manufacturing/application/use-cases/ListarCentrosService'
import { DefinirOperacaoService } from '@/contexts/manufacturing/application/use-cases/DefinirOperacaoService'
import { PublicarRoteiroService } from '@/contexts/manufacturing/application/use-cases/PublicarRoteiroService'
import { AbrirRevisaoRoteiroService } from '@/contexts/manufacturing/application/use-cases/AbrirRevisaoRoteiroService'
import { DescartarRascunhoRoteiroService } from '@/contexts/manufacturing/application/use-cases/DescartarRascunhoRoteiroService'
import { manufacturingController } from '@/contexts/manufacturing/adapters/in/http/ManufacturingController'

type ManufacturingDeps = {
  // The SAME real data in-ports the AI ToolBox and the costing wiring consume; the
  // bridges satisfy their local `*Like` shapes against these structurally.
  data: Pick<
    DataWiring['ports'],
    'listEntities' | 'queryRecords' | 'getRecord' | 'insertRecord' | 'updateRecord' | 'deleteRecord'
  >
}

export function wireManufacturing(infra: Infra, deps: ManufacturingDeps) {
  const { data } = deps

  // ACL bridge: manufacturing EntityRegistry -> data ListEntities.
  const registry = new DataEntityRegistry({ listEntities: data.listEntities })
  // Resolves the workspace owner that record writes must be attributed to
  // (entity_records.created_by is a NOT NULL FK to users.id).
  const resolveOwner = new DrizzleResolveOwner(infra.db)
  // ACL bridge: manufacturing RecordStore -> data ListEntities/QueryRecords/GetRecord/
  // InsertRecord/UpdateRecord/DeleteRecord.
  const store = new DataRecordStore({
    listEntities: data.listEntities,
    query: data.queryRecords,
    get: data.getRecord,
    insert: data.insertRecord,
    update: data.updateRecord,
    delete: data.deleteRecord,
    resolveOwner,
  })

  const obterRoteiro = new ObterRoteiroService(store, registry)
  const definirCentro = new DefinirCentroService(store, registry)
  const listarCentros = new ListarCentrosService(store, registry)
  const definirOperacao = new DefinirOperacaoService(store, registry)
  const publicarRoteiro = new PublicarRoteiroService(store, registry)
  // Clona da revisão publicada, para rascunho, só o que ainda falta no rascunho atual (top-up
  // idempotente). É o que torna estrutural a regra "uma revisão é o conjunto COMPLETO de
  // operações": sem ele, editar uma operação e publicar criaria uma revisão só com ela e as
  // demais sumiriam do custo em silêncio. E por ser top-up, também é a forma de curar um
  // rascunho parcial deixado por uma chamada anterior interrompida no meio dos inserts.
  const abrirRevisaoRoteiro = new AbrirRevisaoRoteiroService(store, registry)
  // Abandona a revisão em rascunho (apaga tudo); a revisão publicada não é tocada. Saída de
  // emergência para desistir de uma edição em andamento, ou recomeçar do zero em vez de curar
  // um rascunho parcial via abrirRevisaoRoteiro.
  const descartarRascunhoRoteiro = new DescartarRascunhoRoteiroService(store, registry)

  const controller = manufacturingController({
    obterRoteiro, definirCentro, listarCentros, definirOperacao, publicarRoteiro, abrirRevisaoRoteiro,
    descartarRascunhoRoteiro,
  })

  return {
    controller,
    ports: {
      obterRoteiro, definirCentro, listarCentros, definirOperacao, publicarRoteiro, abrirRevisaoRoteiro,
      descartarRascunhoRoteiro,
    },
  }
}

export type ManufacturingWiring = ReturnType<typeof wireManufacturing>
