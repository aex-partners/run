// Wiring do contexto `estoque` (livro razão + custo médio ponderado).
// Sem dependência cross-context em tempo de construção: só precisa das in-ports do
// contexto `data`, através de dois bridges ACL.
//   * EntityRegistry -> data ListEntities (resolve entity id por slug).
//   * RecordStore    -> data ListEntities/QueryRecords/GetRecord/InsertRecord/
//                       UpdateRecord/DeleteRecord.
// Roda ANTES de wireCompras na raiz de composição: o EstoqueMovimentosAdapter do
// `compras` é alimentado pela in-port `registrarMovimento` exposta aqui.
import { Infra } from '@/main/wiring/infra'
import { DataWiring } from '@/main/wiring/data'

import { DataEntityRegistry } from '@/contexts/estoque/adapters/out/bridge/DataEntityRegistry'
import { DataRecordStore } from '@/contexts/estoque/adapters/out/bridge/DataRecordStore'
import { DrizzleResolveOwner } from '@/contexts/estoque/adapters/out/persistence/DrizzleResolveOwner'
import { RegistrarMovimentoService } from '@/contexts/estoque/application/use-cases/RegistrarMovimentoService'
import { ConsultarSaldoService } from '@/contexts/estoque/application/use-cases/ConsultarSaldoService'
import { HistoricoMovimentosService } from '@/contexts/estoque/application/use-cases/HistoricoMovimentosService'
import { estoqueController } from '@/contexts/estoque/adapters/in/http/EstoqueController'

type EstoqueDeps = {
  data: Pick<
    DataWiring['ports'],
    'listEntities' | 'queryRecords' | 'getRecord' | 'insertRecord' | 'updateRecord' | 'deleteRecord'
  >
}

export function wireEstoque(infra: Infra, deps: EstoqueDeps) {
  const { data } = deps

  const registry = new DataEntityRegistry({ listEntities: data.listEntities })
  // Resolve o owner ao qual toda escrita de registro é atribuída
  // (entity_records.created_by é FK NOT NULL para users.id). Sem isto, TODA escrita
  // do motor falha em produção.
  const resolveOwner = new DrizzleResolveOwner(infra.db)
  const store = new DataRecordStore({
    listEntities: data.listEntities,
    query: data.queryRecords,
    get: data.getRecord,
    insert: data.insertRecord,
    update: data.updateRecord,
    delete: data.deleteRecord,
    resolveOwner,
  })

  // A PORTA ÚNICA de escrita do estoque. O `compras` entra por ela (entrada_nota), e as
  // Fases 2 (consumo de produção) e 3 (saída de venda) vão entrar pela MESMA porta.
  const registrarMovimento = new RegistrarMovimentoService(store, registry)
  const consultarSaldo = new ConsultarSaldoService(store, registry)
  const historicoMovimentos = new HistoricoMovimentosService(store, registry)

  const controller = estoqueController({ registrarMovimento, consultarSaldo, historicoMovimentos })

  return {
    controller,
    ports: { registrarMovimento, consultarSaldo, historicoMovimentos },
  }
}

export type EstoqueWiring = ReturnType<typeof wireEstoque>
