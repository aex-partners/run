// Mundo de teste do estoque: as três entidades + um insumo com conversão de unidade
// e um depósito. Espelha o que provision-estoque.ts cria.
import { InMemoryRecordStore } from '@/contexts/estoque/adapters/out/fake/InMemoryRecordStore'

export const E = {
  produtos: 'E_PRODUTOS',
  depositos: 'E_DEPOSITOS',
  movimentos: 'E_MOVIMENTOS',
  saldos: 'E_SALDOS',
} as const

export interface InsumoSeed {
  id: string
  controlaEstoque?: boolean
  fatorConversao?: number
  unidadeConsumo?: string
  custoMedio?: number
  saldoTotal?: number
  // Independente de `custoMedio`. Em produção, `preco_custo` já chega com o custo real herdado
  // do ERP antigo (Bling) ANTES de o estoque escrever uma linha sequer -- o mundo de teste
  // precisava conseguir expressar isso (um insumo com custo real e livro vazio), e um fake que
  // sempre iguala os dois campos nunca consegue reproduzir a janela onde eles DIVERGEM. Default
  // preserva o comportamento antigo (espelha `custoMedio`) para não quebrar testes existentes.
  precoCusto?: number
}

export function testWorld(insumos: InsumoSeed[] = [{ id: 'TECIDO' }]) {
  const store = new InMemoryRecordStore()
  store.seedEntity('produtos', E.produtos)
  store.seedEntity('depositos', E.depositos)
  store.seedEntity('movimentos_de_estoque', E.movimentos)
  store.seedEntity('saldos_de_estoque', E.saldos)

  store.seedRecord(E.depositos, { id: 'DEP1', version: 1, data: { nome: 'Fábrica', ativo: true } })
  store.seedRecord(E.depositos, { id: 'DEP2', version: 1, data: { nome: 'Loja', ativo: true } })

  for (const i of insumos) {
    store.seedRecord(E.produtos, {
      id: i.id,
      version: 1,
      data: {
        produto: i.id,
        controla_estoque: i.controlaEstoque ?? true,
        fator_conversao: i.fatorConversao ?? 1,
        unidade_consumo: i.unidadeConsumo ?? 'MT',
        custo_medio: i.custoMedio ?? 0,
        saldo_total: i.saldoTotal ?? 0,
        preco_custo: i.precoCusto ?? i.custoMedio ?? 0,
      },
    })
  }

  return { store, E }
}
