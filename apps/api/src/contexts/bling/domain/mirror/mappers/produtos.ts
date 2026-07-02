import { BlingProdutoFull } from '@/contexts/bling/domain/mirror/BlingApiTypes'
import { MappedRecord, relRef } from '@/contexts/bling/domain/mirror/MappedRecord'
import { nStr, nDate } from '@/contexts/bling/domain/mirror/normalize'

// Bling's `tributacao` bag is loosely typed upstream (Record<string, unknown>);
// narrow it locally to the fields this mapper flattens.
interface BlingProdutoTributacao {
  origem?: number
  nFCI?: string
  ncm?: string
  cest?: string
  codigoListaServicos?: string
  spedTipoItem?: string
  codigoItem?: string
  percentualTributos?: number
  valorBaseStRetencao?: number
  valorStRetencao?: number
  valorICMSSubstituto?: number
  codigoExcecaoTipi?: string
  classeEnquadramentoIpi?: string
  valorIpiFixo?: number
  codigoSeloIpi?: string
  valorPisFixo?: number
  valorCofinsFixo?: number
  codigoANP?: string
  descricaoANP?: string
  percentualGLP?: number
  percentualGasNacional?: number
  percentualGasImportado?: number
  valorPartida?: number
  tipoArmamento?: string
  descricaoCompletaArmamento?: string
  dadosAdicionais?: string
  grupoProduto?: { id?: number }
}

export function mapProduto(full: BlingProdutoFull): MappedRecord[] {
  const out: MappedRecord[] = []
  const trib = (full.tributacao ?? {}) as BlingProdutoTributacao

  out.push({
    slug: 'bling_produtos',
    externalId: String(full.id),
    data: {
      nome: full.nome,
      codigo: nStr(full.codigo),
      preco: full.preco ?? null,
      tipo: nStr(full.tipo),
      situacao: nStr(full.situacao),
      formato: nStr(full.formato),
      descricao_curta: nStr(full.descricaoCurta),
      imagem_url: nStr(full.imagemURL),
      data_validade: nDate(full.dataValidade),
      unidade: nStr(full.unidade),
      peso_liquido: full.pesoLiquido ?? null,
      peso_bruto: full.pesoBruto ?? null,
      volumes: full.volumes ?? null,
      itens_por_caixa: full.itensPorCaixa ?? null,
      gtin: nStr(full.gtin),
      gtin_embalagem: nStr(full.gtinEmbalagem),
      tipo_producao: nStr(full.tipoProducao),
      condicao: nStr(full.condicao),
      frete_gratis: full.freteGratis ?? false,
      marca: nStr(full.marca),
      descricao_complementar: nStr(full.descricaoComplementar),
      link_externo: nStr(full.linkExterno),
      observacoes: nStr(full.observacoes),
      categoria: relRef('bling_categorias_produtos', full.categoria?.id),
      estoque_minimo: full.estoque?.minimo ?? null,
      estoque_maximo: full.estoque?.maximo ?? null,
      estoque_crossdocking: full.estoque?.crossdocking ?? null,
      estoque_localizacao: nStr(full.estoque?.localizacao),
      estoque_saldo_virtual: full.estoque?.saldoVirtualTotal ?? null,
      fornecedor: relRef('bling_contatos', full.fornecedor?.contato?.id),
      fornecedor_codigo: nStr(full.fornecedor?.codigo),
      fornecedor_preco_custo: full.fornecedor?.precoCusto ?? null,
      fornecedor_preco_compra: full.fornecedor?.precoCompra ?? null,
      largura_cm: full.dimensoes?.largura ?? null,
      altura_cm: full.dimensoes?.altura ?? null,
      profundidade_cm: full.dimensoes?.profundidade ?? null,
      dimensoes_unidade_medida: full.dimensoes?.unidadeMedida ?? null,
      trib_origem: trib.origem ?? null,
      trib_nfci: nStr(trib.nFCI),
      trib_ncm: nStr(trib.ncm),
      trib_cest: nStr(trib.cest),
      trib_codigo_lista_servicos: nStr(trib.codigoListaServicos),
      trib_sped_tipo_item: nStr(trib.spedTipoItem),
      trib_codigo_item: nStr(trib.codigoItem),
      trib_percentual_tributos: trib.percentualTributos ?? null,
      trib_valor_base_st_retencao: trib.valorBaseStRetencao ?? null,
      trib_valor_st_retencao: trib.valorStRetencao ?? null,
      trib_valor_icms_substituto: trib.valorICMSSubstituto ?? null,
      trib_codigo_excecao_tipi: nStr(trib.codigoExcecaoTipi),
      trib_classe_enquadramento_ipi: nStr(trib.classeEnquadramentoIpi),
      trib_valor_ipi_fixo: trib.valorIpiFixo ?? null,
      trib_codigo_selo_ipi: nStr(trib.codigoSeloIpi),
      trib_valor_pis_fixo: trib.valorPisFixo ?? null,
      trib_valor_cofins_fixo: trib.valorCofinsFixo ?? null,
      trib_codigo_anp: nStr(trib.codigoANP),
      trib_descricao_anp: nStr(trib.descricaoANP),
      trib_percentual_glp: trib.percentualGLP ?? null,
      trib_percentual_gas_nacional: trib.percentualGasNacional ?? null,
      trib_percentual_gas_importado: trib.percentualGasImportado ?? null,
      trib_valor_partida: trib.valorPartida ?? null,
      trib_tipo_armamento: nStr(trib.tipoArmamento),
      trib_descricao_armamento: nStr(trib.descricaoCompletaArmamento),
      trib_dados_adicionais: nStr(trib.dadosAdicionais),
      trib_grupo_produto_id: trib.grupoProduto?.id ? String(trib.grupoProduto.id) : null,
      video_url: nStr(full.midia?.video?.url),
      linha_produto_id: full.linhaProduto?.id ? String(full.linhaProduto.id) : null,
      estrutura_tipo_estoque: nStr(full.estrutura?.tipoEstoque),
      estrutura_lancamento_estoque: nStr(full.estrutura?.lancamentoEstoque),
    },
  })

  for (const v of full.variacoes ?? []) {
    out.push({
      slug: 'bling_produto_variacoes',
      externalId: String(v.id),
      data: {
        produto_pai: relRef('bling_produtos', full.id),
        variacao_nome: v.variacao?.nome ?? '',
        variacao_ordem: v.variacao?.ordem ?? null,
        clone_info: v.variacao?.cloneInfo ?? false,
        nome: nStr(v.nome),
        codigo: nStr(v.codigo),
        preco: v.preco ?? null,
        gtin: nStr(v.gtin),
        estoque_saldo_virtual: v.estoque?.saldoVirtualTotal ?? null,
      },
    })
  }

  for (const c of full.estrutura?.componentes ?? []) {
    const componenteId = c.produto?.id
    if (!componenteId) continue
    out.push({
      slug: 'bling_produto_componentes',
      externalId: String(c.id ?? `${full.id}:${componenteId}`),
      data: {
        produto: relRef('bling_produtos', full.id),
        componente: relRef('bling_produtos', componenteId),
        quantidade: c.quantidade,
      },
    })
  }

  for (const cc of full.camposCustomizados ?? []) {
    out.push({
      slug: 'bling_produto_campos_customizados',
      externalId: String(cc.idVinculo ?? `${full.id}:${cc.idCampoCustomizado}`),
      data: {
        produto: relRef('bling_produtos', full.id),
        id_campo_customizado: cc.idCampoCustomizado,
        id_vinculo: cc.idVinculo ?? null,
        valor: nStr(cc.valor),
        item: nStr(cc.item),
      },
    })
  }

  let extIdx = 0
  for (const img of full.midia?.imagens?.externas ?? []) {
    out.push({
      slug: 'bling_produto_imagens_externas',
      externalId: String(img.id ?? `${full.id}:ext:${extIdx++}`),
      data: { produto: relRef('bling_produtos', full.id), link: img.link },
    })
  }

  let intIdx = 0
  for (const img of full.midia?.imagens?.internas ?? []) {
    out.push({
      slug: 'bling_produto_imagens_internas',
      externalId: String(img.id ?? `${full.id}:int:${intIdx++}`),
      data: {
        produto: relRef('bling_produtos', full.id),
        link_miniatura: nStr(img.linkMiniatura),
        validade: nDate(img.validade),
        ordem: img.ordem ?? null,
        anexo_id: img.anexo?.id ? String(img.anexo.id) : null,
        anexo_vinculo_id: img.anexo?.vinculo?.id ? String(img.anexo.vinculo.id) : null,
      },
    })
  }

  return out
}
