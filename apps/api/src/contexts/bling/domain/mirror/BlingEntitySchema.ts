export const BLING_SOURCE = 'bling'

// Local field-type descriptor for the mirror entities this context seeds into
// the data catalog. Structurally identical to data's FieldTypeConfig for the
// kinds this mirror actually uses -- kept local (not imported from the data
// context) so bling's domain never crosses the context boundary at the type
// level. The ACL bridge (DataEntityCatalog, in adapters/out/bridge) hands these
// straight to data's CreateEntity/AddField in-ports, whose parameter types
// accept this narrower shape structurally.
export type BlingFieldTypeConfig =
  | { kind: 'text' }
  | { kind: 'long_text' }
  | { kind: 'url' }
  | { kind: 'email' }
  | { kind: 'number' }
  | { kind: 'currency'; currencyCode?: string }
  | { kind: 'date' }
  | { kind: 'boolean' }
  | { kind: 'relation'; targetEntityId: string; targetEntityName?: string }

export interface BlingFieldDef {
  name: string
  type: BlingFieldTypeConfig
  required?: boolean
  relationTargetSlug?: string
}
export interface BlingEntityDef {
  slug: string
  name: string
  aiContext?: string
  fields: BlingFieldDef[]
}

const text = (name: string, required = false): BlingFieldDef => ({ name, type: { kind: 'text' }, required })
const long = (name: string): BlingFieldDef => ({ name, type: { kind: 'long_text' } })
const url = (name: string): BlingFieldDef => ({ name, type: { kind: 'url' } })
const email = (name: string): BlingFieldDef => ({ name, type: { kind: 'email' } })
const num = (name: string): BlingFieldDef => ({ name, type: { kind: 'number' } })
const money = (name: string): BlingFieldDef => ({ name, type: { kind: 'currency', currencyCode: 'BRL' } })
const date = (name: string): BlingFieldDef => ({ name, type: { kind: 'date' } })
const bool = (name: string): BlingFieldDef => ({ name, type: { kind: 'boolean' } })
const rel = (name: string, targetSlug: string, required = false): BlingFieldDef => ({
  name, required, relationTargetSlug: targetSlug, type: { kind: 'relation', targetEntityId: '' },
})

export const BLING_ENTITIES = [
  // ---- Tier 1: catalogs ----
  { slug: 'bling_categorias_produtos', name: 'Bling Categorias Produtos', fields: [
    text('descricao', true), rel('categoria_pai', 'bling_categorias_produtos'),
  ] },
  { slug: 'bling_depositos', name: 'Bling Depositos', fields: [
    text('descricao', true), text('situacao'), bool('padrao'), bool('desconsiderar_saldo'),
  ] },
  { slug: 'bling_formas_pagamento', name: 'Bling Formas Pagamento', fields: [
    text('descricao', true), text('tipo_pagamento'), text('situacao'), bool('fixa'), text('padrao'),
    text('condicao'), text('destino'), text('finalidade'), num('taxa_aliquota'), money('taxa_valor'),
    num('taxa_prazo'), text('cartao_bandeira'), text('cartao_tipo'), text('cartao_cnpj_credenciadora'),
  ] },
  { slug: 'bling_tipos_contato', name: 'Bling Tipos Contato', fields: [ text('descricao', true) ] },

  // ---- Tier 2: contatos ----
  { slug: 'bling_contatos', name: 'Bling Contatos', fields: [
    text('nome', true), text('codigo'), text('situacao'), text('numero_documento'), text('telefone'),
    text('celular'), text('fantasia'), text('tipo'), text('indicador_ie'), text('ie'), text('rg'),
    text('orgao_emissor'), email('email'),
    text('endereco_geral_logradouro'), text('endereco_geral_cep'), text('endereco_geral_bairro'),
    text('endereco_geral_municipio'), text('endereco_geral_uf'), text('endereco_geral_numero'),
    text('endereco_geral_complemento'),
    text('endereco_cobranca_logradouro'), text('endereco_cobranca_cep'), text('endereco_cobranca_bairro'),
    text('endereco_cobranca_municipio'), text('endereco_cobranca_uf'), text('endereco_cobranca_numero'),
    text('endereco_cobranca_complemento'),
    text('vendedor_id'), date('data_nascimento'), text('sexo'), text('naturalidade'),
    money('limite_credito'), text('condicao_pagamento'), text('categoria_financeira_id'), text('pais'),
  ] },
  { slug: 'bling_pessoas_contato', name: 'Bling Pessoas Contato', fields: [
    rel('contato', 'bling_contatos', true), text('descricao'),
  ] },
  { slug: 'bling_contato_tipos_assigned', name: 'Bling Contato Tipos Assigned', fields: [
    rel('contato', 'bling_contatos', true), rel('tipo', 'bling_tipos_contato', true),
  ] },

  // ---- Tier 3: produtos ----
  { slug: 'bling_produtos', name: 'Bling Produtos', fields: [
    text('nome', true), text('codigo'), money('preco'), text('tipo'), text('situacao'), text('formato'),
    text('descricao_curta'), url('imagem_url'), date('data_validade'), text('unidade'),
    num('peso_liquido'), num('peso_bruto'), num('volumes'), num('itens_por_caixa'), text('gtin'),
    text('gtin_embalagem'), text('tipo_producao'), text('condicao'), bool('frete_gratis'), text('marca'),
    long('descricao_complementar'), url('link_externo'), long('observacoes'),
    rel('categoria', 'bling_categorias_produtos'),
    num('estoque_minimo'), num('estoque_maximo'), num('estoque_crossdocking'), text('estoque_localizacao'),
    num('estoque_saldo_virtual'),
    rel('fornecedor', 'bling_contatos'), text('fornecedor_codigo'), money('fornecedor_preco_custo'),
    money('fornecedor_preco_compra'),
    num('largura_cm'), num('altura_cm'), num('profundidade_cm'), num('dimensoes_unidade_medida'),
    num('trib_origem'), text('trib_nfci'), text('trib_ncm'), text('trib_cest'),
    text('trib_codigo_lista_servicos'), text('trib_sped_tipo_item'), text('trib_codigo_item'),
    num('trib_percentual_tributos'), money('trib_valor_base_st_retencao'), money('trib_valor_st_retencao'),
    money('trib_valor_icms_substituto'), text('trib_codigo_excecao_tipi'), text('trib_classe_enquadramento_ipi'),
    money('trib_valor_ipi_fixo'), text('trib_codigo_selo_ipi'), money('trib_valor_pis_fixo'),
    money('trib_valor_cofins_fixo'), text('trib_codigo_anp'), text('trib_descricao_anp'),
    num('trib_percentual_glp'), num('trib_percentual_gas_nacional'), num('trib_percentual_gas_importado'),
    money('trib_valor_partida'), text('trib_tipo_armamento'), text('trib_descricao_armamento'),
    text('trib_dados_adicionais'), text('trib_grupo_produto_id'),
    url('video_url'), text('linha_produto_id'), text('estrutura_tipo_estoque'), text('estrutura_lancamento_estoque'),
  ] },
  { slug: 'bling_produto_variacoes', name: 'Bling Produto Variacoes', fields: [
    rel('produto_pai', 'bling_produtos', true), text('variacao_nome'), num('variacao_ordem'),
    bool('clone_info'), text('nome'), text('codigo'), money('preco'), text('gtin'), num('estoque_saldo_virtual'),
  ] },
  { slug: 'bling_produto_componentes', name: 'Bling Produto Componentes', fields: [
    rel('produto', 'bling_produtos', true), rel('componente', 'bling_produtos', true), num('quantidade'),
  ] },
  { slug: 'bling_produto_campos_customizados', name: 'Bling Produto Campos Customizados', fields: [
    rel('produto', 'bling_produtos', true), num('id_campo_customizado'), num('id_vinculo'), text('valor'), text('item'),
  ] },
  { slug: 'bling_produto_imagens_externas', name: 'Bling Produto Imagens Externas', fields: [
    rel('produto', 'bling_produtos', true), url('link'),
  ] },
  { slug: 'bling_produto_imagens_internas', name: 'Bling Produto Imagens Internas', fields: [
    rel('produto', 'bling_produtos', true), url('link_miniatura'), date('validade'), num('ordem'),
    text('anexo_id'), text('anexo_vinculo_id'),
  ] },

  // ---- Tier 4: pedidos ----
  { slug: 'bling_pedidos_venda', name: 'Bling Pedidos Venda', fields: [
    num('numero'), text('numero_loja'), date('data'), date('data_saida'), date('data_prevista'),
    money('total_produtos'), money('total'), rel('contato', 'bling_contatos', true),
    num('situacao_id'), num('situacao_valor'), text('loja_id'), text('numero_pedido_compra'),
    money('outras_despesas'), long('observacoes'), long('observacoes_internas'), money('desconto_valor'),
    text('desconto_unidade'), text('categoria_id'), text('nota_fiscal_id'), money('total_icms'), money('total_ipi'),
    text('frete_por_conta'), money('frete'), num('quantidade_volumes'), num('peso_bruto'), num('prazo_entrega'),
    rel('transportadora', 'bling_contatos'),
    text('etiqueta_nome'), text('etiqueta_logradouro'), text('etiqueta_numero'), text('etiqueta_complemento'),
    text('etiqueta_municipio'), text('etiqueta_uf'), text('etiqueta_cep'), text('etiqueta_bairro'), text('etiqueta_pais'),
    text('vendedor_id'), text('intermediador_cnpj'), text('intermediador_nome'),
    num('taxa_comissao'), money('custo_frete'), money('valor_base'),
  ] },
  { slug: 'bling_pedido_venda_itens', name: 'Bling Pedido Venda Itens', fields: [
    rel('pedido', 'bling_pedidos_venda', true), text('codigo'), text('unidade'), num('quantidade'),
    num('desconto'), money('valor'), num('aliquota_ipi'), text('descricao'), long('descricao_detalhada'),
    rel('produto', 'bling_produtos'), num('comissao_base'), num('comissao_aliquota'), money('comissao_valor'),
  ] },
  { slug: 'bling_pedido_venda_parcelas', name: 'Bling Pedido Venda Parcelas', fields: [
    rel('pedido', 'bling_pedidos_venda', true), date('data_vencimento'), money('valor'), text('observacoes'),
    rel('forma_pagamento', 'bling_formas_pagamento'),
  ] },
  { slug: 'bling_pedido_venda_volumes', name: 'Bling Pedido Venda Volumes', fields: [
    rel('pedido', 'bling_pedidos_venda', true), text('servico'), text('codigo_rastreamento'),
  ] },
] satisfies BlingEntityDef[]

export type BlingEntitySlug = (typeof BLING_ENTITIES)[number]['slug']
