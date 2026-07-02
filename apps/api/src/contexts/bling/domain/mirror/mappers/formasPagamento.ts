import { BlingFormaPagamento } from '@/contexts/bling/domain/mirror/BlingApiTypes'
import { MappedRecord } from '@/contexts/bling/domain/mirror/MappedRecord'
import { nStr } from '@/contexts/bling/domain/mirror/normalize'

export function mapFormaPagamento(raw: BlingFormaPagamento): MappedRecord {
  return {
    slug: 'bling_formas_pagamento', externalId: String(raw.id),
    data: {
      descricao: raw.descricao, tipo_pagamento: nStr(raw.tipoPagamento), situacao: nStr(raw.situacao),
      fixa: raw.fixa ?? false, padrao: nStr(raw.padrao), condicao: nStr(raw.condicao), destino: nStr(raw.destino),
      finalidade: nStr(raw.finalidade), taxa_aliquota: raw.taxas?.aliquota ?? null, taxa_valor: raw.taxas?.valor ?? null,
      taxa_prazo: raw.taxas?.prazo ?? null, cartao_bandeira: nStr(raw.cartao?.bandeira), cartao_tipo: nStr(raw.cartao?.tipo),
      cartao_cnpj_credenciadora: nStr(raw.cartao?.cnpjCredenciadora),
    },
  }
}
