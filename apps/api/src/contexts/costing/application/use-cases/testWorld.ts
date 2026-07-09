import { InMemoryRecordStore } from '@/contexts/costing/adapters/out/fake/InMemoryRecordStore'

export function seedWorld() {
  const s = new InMemoryRecordStore()
  for (const slug of ['produtos', 'modelos', 'variacoes', 'fichas_tecnicas', 'substituicoes', 'fichas_explodidas', 'snapshots_custo'])
    s.seedEntity(slug, slug.toUpperCase())
  // variações: tamanho T38 (fator 100) + cor CAQUI
  s.seedRecord('VARIACOES', { id: 'T38', version: 1, data: { variacao: 'T38', fator_qtd: 100 } })
  s.seedRecord('VARIACOES', { id: 'CAQUI', version: 1, data: { variacao: 'Caqui' } })
  // produtos: fantasma PH, tecido real, botão, e o SKU final
  s.seedRecord('PRODUTOS', { id: 'PH', version: 1, data: { produto: 'TECIDO PRINCIPAL', fantasma: true } })
  s.seedRecord('PRODUTOS', { id: 'SARJA', version: 1, data: { produto: 'SARJA CAQUI', preco_custo: 20 } })
  s.seedRecord('PRODUTOS', { id: 'BTN', version: 1, data: { produto: 'BOTAO', preco_custo: 0.3 } })
  s.seedRecord('PRODUTOS', { id: 'SKU', version: 1, data: { produto: 'BOMBACHA T38 CAQUI', modelo: 'M1', variacoes: ['T38', 'CAQUI'] } })
  // ficha do modelo (rev 1 publicada)
  s.seedRecord('FICHAS_TECNICAS', { id: 'f1', version: 1, data: { modelo: 'M1', item: 'PH', unidade: 'm2', qty_base: 1.4, qty_por_tamanho: JSON.stringify({ T38: 1.4 }), rev: 1, status: 'publicada' } })
  s.seedRecord('FICHAS_TECNICAS', { id: 'f2', version: 1, data: { modelo: 'M1', item: 'BTN', unidade: 'un', qty_base: 2, qty_por_tamanho: '{}', rev: 1, status: 'publicada' } })
  // substituição da cor
  s.seedRecord('SUBSTITUICOES', { id: 'sub1', version: 1, data: { variacao: 'CAQUI', de_item: 'PH', para_item: 'SARJA' } })
  return s
}
