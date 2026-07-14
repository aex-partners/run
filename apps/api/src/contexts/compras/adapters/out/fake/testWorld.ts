// Mundo de teste do compras: as 5 entidades + produtos (com conversão de unidade)
// + depósito + fornecedor. Espelha o que provision-compras.ts + provision-estoque.ts criam.
import { InMemoryRecordStore } from '@/contexts/compras/adapters/out/fake/InMemoryRecordStore'

export const E = {
  produtos: 'C_PRODUTOS',
  pessoas: 'C_PESSOAS',
  depositos: 'C_DEPOSITOS',
  pedidos: 'C_PEDIDOS',
  itensPedido: 'C_ITENS_PEDIDO',
  notas: 'C_NOTAS',
  itensNota: 'C_ITENS_NOTA',
  politica: 'C_POLITICA',
} as const

export interface InsumoSeed {
  id: string
  controlaEstoque?: boolean
  fatorConversao?: number
}

export function testWorld(insumos: InsumoSeed[] = [{ id: 'TECIDO' }]) {
  const store = new InMemoryRecordStore()
  store.seedEntity('produtos', E.produtos)
  store.seedEntity('pessoas', E.pessoas)
  store.seedEntity('depositos', E.depositos)
  store.seedEntity('pedidos_de_compra', E.pedidos)
  store.seedEntity('itens_pedido_compra', E.itensPedido)
  store.seedEntity('notas_de_entrada', E.notas)
  store.seedEntity('itens_nota_entrada', E.itensNota)
  store.seedEntity('politica_de_custo_compra', E.politica)

  store.seedRecord(E.pessoas, { id: 'FORN1', version: 1, data: { nome: 'Tecelagem X' } })
  store.seedRecord(E.depositos, { id: 'DEP1', version: 1, data: { nome: 'Fábrica', ativo: true } })

  for (const i of insumos) {
    store.seedRecord(E.produtos, {
      id: i.id,
      version: 1,
      data: {
        produto: i.id,
        controla_estoque: i.controlaEstoque ?? true,
        fator_conversao: i.fatorConversao ?? 1,
      },
    })
  }

  return { store, E }
}
