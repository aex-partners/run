// Mundo de teste: as entidades de precificação + modelos + produtos (com custo) +
// condicoes_pagamento. Espelha o que provision-precificacao.ts + o Bling criam.
import { InMemoryRecordStore } from '@/contexts/precificacao/adapters/out/fake/InMemoryRecordStore'

export const E = {
  modelos: 'P_MODELOS', produtos: 'P_PRODUTOS', condicoes: 'P_CONDICOES',
  canais: 'P_CANAIS', parametros: 'P_PARAMS', politica: 'P_POLITICA', precos: 'P_PRECOS',
} as const

export function testWorld() {
  const store = new InMemoryRecordStore()
  store.seedEntity('modelos', E.modelos)
  store.seedEntity('produtos', E.produtos)
  store.seedEntity('condicoes_pagamento', E.condicoes)
  store.seedEntity('canais_de_venda', E.canais)
  store.seedEntity('parametros_de_preco', E.parametros)
  store.seedEntity('politica_de_preco', E.politica)
  store.seedEntity('precos_de_venda', E.precos)

  store.seedRecord(E.modelos, { id: 'MOD', version: 1, data: { nome: 'CAMPESINA ADULTA' } })
  store.seedRecord(E.produtos, { id: 'SKU', version: 1, data: { produto: 'CAMPESINA BEGE RISCA 38', modelo: 'MOD', custo_unitario_total: 64.618316972557722 } })
  store.seedRecord(E.condicoes, { id: 'AVISTA', version: 1, data: { nome: 'À vista', desp_financeira: 0 } })
  store.seedRecord(E.condicoes, { id: 'PRAZO30', version: 1, data: { nome: '30 dias', desp_financeira: 0.02 } })
  store.seedRecord(E.canais, { id: 'LOJISTA', version: 1, data: { nome: 'lojista', comissao: 0.10, frete: 0, ativo: true } })
  store.seedRecord(E.parametros, { id: 'PAR', version: 1, data: { imposto: 0.0333, iss: 0 } })
  store.seedRecord(E.politica, { id: 'POL', version: 1, data: { modelo: 'MOD', canal: 'LOJISTA', lucro_alvo: 0 } })
  return { store, E }
}
