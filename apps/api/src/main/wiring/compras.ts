// Wiring do contexto `compras` (pedido de compra + nota de entrada + política de custo).
// Bridges ACL:
//   * EntityRegistry     -> data ListEntities.
//   * RecordStore        -> data (CRUD sobre os registros dinâmicos).
//   * EstoqueMovimentos  -> estoque RegistrarMovimento. É o ÚNICO ponto de contato entre
//                           `compras` e `estoque`, e é por isso que a raiz de composição
//                           constrói wireEstoque ANTES daqui.
//
// `compras` NÃO conhece o `costing`: lançar uma nota não recalcula ficha nenhuma. O custo
// do PRODUTO só muda por RecalcularCusto, explicitamente.
import { Infra } from '@/main/wiring/infra'
import { DataWiring } from '@/main/wiring/data'
import { EstoqueWiring } from '@/main/wiring/estoque'

import { DataEntityRegistry } from '@/contexts/compras/adapters/out/bridge/DataEntityRegistry'
import { DataRecordStore } from '@/contexts/compras/adapters/out/bridge/DataRecordStore'
import { EstoqueMovimentosAdapter } from '@/contexts/compras/adapters/out/bridge/EstoqueMovimentosAdapter'
import { DrizzleResolveOwner } from '@/contexts/compras/adapters/out/persistence/DrizzleResolveOwner'
import { CriarPedidoCompraService } from '@/contexts/compras/application/use-cases/CriarPedidoCompraService'
import { LancarNotaEntradaService } from '@/contexts/compras/application/use-cases/LancarNotaEntradaService'
import { ConsultarPedidoCompraService } from '@/contexts/compras/application/use-cases/ConsultarPedidoCompraService'
import { comprasController } from '@/contexts/compras/adapters/in/http/ComprasController'

type ComprasDeps = {
  data: Pick<
    DataWiring['ports'],
    'listEntities' | 'queryRecords' | 'getRecord' | 'insertRecord' | 'updateRecord' | 'deleteRecord'
  >
  // A in-port RegistrarMovimento do estoque: a ÚNICA coisa que o `compras` precisa
  // daquele contexto (via o bridge EstoqueMovimentosAdapter).
  estoque: Pick<EstoqueWiring['ports'], 'registrarMovimento'>
}

export function wireCompras(infra: Infra, deps: ComprasDeps) {
  const { data, estoque } = deps

  const registry = new DataEntityRegistry({ listEntities: data.listEntities })
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

  // ACL bridge: compras EstoqueMovimentos -> estoque RegistrarMovimento. A nota de
  // entrada empurra uma entrada por item, já CONVERTIDA para a unidade de consumo.
  const movimentos = new EstoqueMovimentosAdapter({ registrarMovimento: estoque.registrarMovimento })

  const criarPedidoCompra = new CriarPedidoCompraService(store, registry)
  const lancarNotaEntrada = new LancarNotaEntradaService(store, registry, movimentos)
  const consultarPedidoCompra = new ConsultarPedidoCompraService(store, registry)

  const controller = comprasController({ criarPedidoCompra, lancarNotaEntrada, consultarPedidoCompra })

  return {
    controller,
    ports: { criarPedidoCompra, lancarNotaEntrada, consultarPedidoCompra },
  }
}

export type ComprasWiring = ReturnType<typeof wireCompras>
