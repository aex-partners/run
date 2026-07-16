// Wiring do contexto `precificacao` (preço de venda = marcação sobre o custo).
// Sem dependência cross-context em tempo de construção: liga direto nas in-ports do
// contexto `data`, através de dois bridges ACL (o MESMO padrão do `estoque`/`costing`).
//   * EntityRegistry -> data ListEntities (resolve entity id por slug).
//   * RecordStore    -> data ListEntities/QueryRecords/GetRecord/InsertRecord/
//                       UpdateRecord/DeleteRecord.
// Só LÊ produtos.custo_unitario_total e snapshots_custo; NÃO chama o costing e NÃO
// altera custo. Sem ordem obrigatória em relação a outros contextos.
import { Infra } from '@/main/wiring/infra'
import { DataWiring } from '@/main/wiring/data'

import { DataEntityRegistry } from '@/contexts/precificacao/adapters/out/bridge/DataEntityRegistry'
import { DataRecordStore } from '@/contexts/precificacao/adapters/out/bridge/DataRecordStore'
import { DrizzleResolveOwner } from '@/contexts/precificacao/adapters/out/persistence/DrizzleResolveOwner'
import { DefinirCanalService } from '@/contexts/precificacao/application/use-cases/DefinirCanalService'
import { DefinirParametrosService } from '@/contexts/precificacao/application/use-cases/DefinirParametrosService'
import { DefinirCondicaoFinanceiraService } from '@/contexts/precificacao/application/use-cases/DefinirCondicaoFinanceiraService'
import { DefinirLucroService } from '@/contexts/precificacao/application/use-cases/DefinirLucroService'
import { GerarPrecosService } from '@/contexts/precificacao/application/use-cases/GerarPrecosService'
import { ConsultarPrecoService } from '@/contexts/precificacao/application/use-cases/ConsultarPrecoService'
import { PrecosDesatualizadosService } from '@/contexts/precificacao/application/use-cases/PrecosDesatualizadosService'
import { precificacaoController } from '@/contexts/precificacao/adapters/in/http/PrecificacaoController'

type PrecificacaoDeps = {
  data: Pick<
    DataWiring['ports'],
    'listEntities' | 'queryRecords' | 'getRecord' | 'insertRecord' | 'updateRecord' | 'deleteRecord'
  >
}

export function wirePrecificacao(infra: Infra, deps: PrecificacaoDeps) {
  const { data } = deps

  const registry = new DataEntityRegistry({ listEntities: data.listEntities })
  // Resolve o owner ao qual toda escrita de registro é atribuída
  // (entity_records.created_by é FK NOT NULL para users.id). Sem isto, TODA escrita
  // do motor (gerar_precos grava precos_de_venda) falha em produção.
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

  const definirCanal = new DefinirCanalService(store, registry)
  const definirParametros = new DefinirParametrosService(store, registry)
  // Não cria entidade: condições de pagamento já existem (Bling). Só ajusta a
  // desp. financeira preservando o resto do registro; não precisa do registry.
  const definirCondicaoFinanceira = new DefinirCondicaoFinanceiraService(store)
  const definirLucro = new DefinirLucroService(store, registry)
  const gerarPrecos = new GerarPrecosService(store, registry)
  const consultarPreco = new ConsultarPrecoService(store, registry)
  const precosDesatualizados = new PrecosDesatualizadosService(store, registry)

  const controller = precificacaoController({
    definirCanal, definirParametros, definirCondicaoFinanceira, definirLucro,
    gerarPrecos, consultarPreco, precosDesatualizados,
  })

  return {
    controller,
    ports: {
      definirCanal, definirParametros, definirCondicaoFinanceira, definirLucro,
      gerarPrecos, consultarPreco, precosDesatualizados,
    },
  }
}

export type PrecificacaoWiring = ReturnType<typeof wirePrecificacao>
