import { BlingPedidoVendaFull } from '@/contexts/bling/domain/mirror/BlingApiTypes'
import { MappedRecord, relRef } from '@/contexts/bling/domain/mirror/MappedRecord'
import { nStr, nDate } from '@/contexts/bling/domain/mirror/normalize'

export function mapPedidoVenda(full: BlingPedidoVendaFull): MappedRecord[] {
  const out: MappedRecord[] = []

  out.push({
    slug: 'bling_pedidos_venda',
    externalId: String(full.id),
    data: {
      numero: full.numero ?? null,
      numero_loja: nStr(full.numeroLoja),
      data: nDate(full.data),
      data_saida: nDate(full.dataSaida),
      data_prevista: nDate(full.dataPrevista),
      total_produtos: full.totalProdutos ?? null,
      total: full.total ?? null,
      contato: relRef('bling_contatos', full.contato?.id),
      situacao_id: full.situacao?.id ?? null,
      situacao_valor: full.situacao?.valor ?? null,
      loja_id: full.loja?.id ? String(full.loja.id) : null,
      numero_pedido_compra: nStr(full.numeroPedidoCompra),
      outras_despesas: full.outrasDespesas ?? null,
      observacoes: nStr(full.observacoes),
      observacoes_internas: nStr(full.observacoesInternas),
      desconto_valor: full.desconto?.valor ?? null,
      desconto_unidade: nStr(full.desconto?.unidade),
      categoria_id: full.categoria?.id ? String(full.categoria.id) : null,
      nota_fiscal_id: full.notaFiscal?.id ? String(full.notaFiscal.id) : null,
      total_icms: full.tributacao?.totalICMS ?? null,
      total_ipi: full.tributacao?.totalIPI ?? null,
      frete_por_conta: nStr(full.transporte?.fretePorConta),
      frete: full.transporte?.frete ?? null,
      quantidade_volumes: full.transporte?.quantidadeVolumes ?? null,
      peso_bruto: full.transporte?.pesoBruto ?? null,
      prazo_entrega: full.transporte?.prazoEntrega ?? null,
      transportadora: relRef('bling_contatos', full.transporte?.contato?.id),
      etiqueta_nome: nStr(full.transporte?.etiqueta?.nome),
      etiqueta_logradouro: nStr(full.transporte?.etiqueta?.endereco),
      etiqueta_numero: nStr(full.transporte?.etiqueta?.numero),
      etiqueta_complemento: nStr(full.transporte?.etiqueta?.complemento),
      etiqueta_municipio: nStr(full.transporte?.etiqueta?.municipio),
      etiqueta_uf: nStr(full.transporte?.etiqueta?.uf),
      etiqueta_cep: nStr(full.transporte?.etiqueta?.cep),
      etiqueta_bairro: nStr(full.transporte?.etiqueta?.bairro),
      etiqueta_pais: nStr(full.transporte?.etiqueta?.nomePais),
      vendedor_id: full.vendedor?.id ? String(full.vendedor.id) : null,
      intermediador_cnpj: nStr(full.intermediador?.cnpj),
      intermediador_nome: nStr(full.intermediador?.nomeUsuario),
      taxa_comissao: full.taxas?.taxaComissao ?? null,
      custo_frete: full.taxas?.custoFrete ?? null,
      valor_base: full.taxas?.valorBase ?? null,
    },
  })

  let itemIdx = 0
  for (const it of full.itens ?? []) {
    out.push({
      slug: 'bling_pedido_venda_itens',
      externalId: String(it.id ?? `${full.id}:item:${itemIdx++}`),
      data: {
        pedido: relRef('bling_pedidos_venda', full.id),
        codigo: nStr(it.codigo),
        unidade: nStr(it.unidade),
        quantidade: it.quantidade,
        desconto: it.desconto ?? null,
        valor: it.valor,
        aliquota_ipi: it.aliquotaIPI ?? null,
        descricao: it.descricao,
        descricao_detalhada: nStr(it.descricaoDetalhada),
        produto: relRef('bling_produtos', it.produto?.id),
        comissao_base: it.comissao?.base ?? null,
        comissao_aliquota: it.comissao?.aliquota ?? null,
        comissao_valor: it.comissao?.valor ?? null,
      },
    })
  }

  let parcIdx = 0
  for (const p of full.parcelas ?? []) {
    out.push({
      slug: 'bling_pedido_venda_parcelas',
      externalId: String(p.id ?? `${full.id}:parc:${parcIdx++}`),
      data: {
        pedido: relRef('bling_pedidos_venda', full.id),
        data_vencimento: nDate(p.dataVencimento),
        valor: p.valor,
        observacoes: nStr(p.observacoes),
        forma_pagamento: relRef('bling_formas_pagamento', p.formaPagamento?.id),
      },
    })
  }

  let volIdx = 0
  for (const v of full.transporte?.volumes ?? []) {
    out.push({
      slug: 'bling_pedido_venda_volumes',
      externalId: String(v.id ?? `${full.id}:vol:${volIdx++}`),
      data: {
        pedido: relRef('bling_pedidos_venda', full.id),
        servico: v.servico,
        codigo_rastreamento: nStr(v.codigoRastreamento),
      },
    })
  }

  return out
}
