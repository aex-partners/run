export interface BlingListResponse<T> {
  data: T[];
}

export interface BlingSingleResponse<T> {
  data: T;
}

// === Tier 1 ===
export interface BlingCategoriaProduto {
  id: number;
  descricao: string;
  categoriaPai?: { id: number };
}

export interface BlingDeposito {
  id: number;
  descricao: string;
  situacao?: number;
  padrao?: boolean;
  desconsiderarSaldo?: boolean;
}

export interface BlingFormaPagamento {
  id: number;
  descricao: string;
  tipoPagamento?: number;
  situacao?: number;
  fixa?: boolean;
  padrao?: number | string;
  finalidade?: number;
  condicao?: string;
  destino?: number;
  taxas?: { aliquota?: number; valor?: number; prazo?: number };
  cartao?: { bandeira?: string; tipo?: string; cnpjCredenciadora?: string };
}

export interface BlingTipoContato {
  id: number;
  descricao: string;
}

// === Tier 2 ===
export interface BlingContatoListItem {
  id: number;
  nome: string;
  codigo?: string;
  situacao?: string;
  numeroDocumento?: string;
  telefone?: string;
  celular?: string;
}

export interface BlingContatoFull extends BlingContatoListItem {
  fantasia?: string;
  tipo?: string;
  indicadorIe?: number;
  ie?: string;
  rg?: string;
  orgaoEmissor?: string;
  email?: string;
  endereco?: {
    geral?: BlingEndereco;
    cobranca?: BlingEndereco;
  };
  vendedor?: { id: number };
  dadosAdicionais?: { dataNascimento?: string; sexo?: string; naturalidade?: string };
  financeiro?: { limiteCredito?: number; condicaoPagamento?: string; categoria?: { id: number } };
  pais?: { nome?: string };
  tiposContato?: Array<{ id: number; descricao: string }>;
  pessoasContato?: Array<{ id?: number; nome?: string; descricao?: string }>;
}

export interface BlingEndereco {
  endereco?: string;
  cep?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  numero?: string;
  complemento?: string;
}

// === Tier 3 ===
export interface BlingProdutoListItem {
  id: number;
  nome: string;
  codigo?: string;
  preco?: number;
  tipo?: string;
  situacao?: string;
  formato?: string;
}

export interface BlingProdutoFull extends BlingProdutoListItem {
  descricaoCurta?: string;
  imagemURL?: string;
  dataValidade?: string;
  unidade?: string;
  pesoLiquido?: number;
  pesoBruto?: number;
  volumes?: number;
  itensPorCaixa?: number;
  gtin?: string;
  gtinEmbalagem?: string;
  tipoProducao?: string;
  condicao?: number | string;
  freteGratis?: boolean;
  marca?: string;
  descricaoComplementar?: string;
  linkExterno?: string;
  observacoes?: string;
  categoria?: { id: number };
  estoque?: {
    minimo?: number;
    maximo?: number;
    crossdocking?: number;
    localizacao?: string;
    saldoVirtualTotal?: number;
  };
  fornecedor?: {
    id?: number;
    contato?: { id: number; nome?: string };
    codigo?: string;
    precoCusto?: number;
    precoCompra?: number;
  };
  dimensoes?: { largura?: number; altura?: number; profundidade?: number; unidadeMedida?: number };
  tributacao?: Record<string, unknown>;
  midia?: {
    video?: { url?: string };
    imagens?: {
      externas?: Array<{ id?: number; link: string }>;
      internas?: Array<{ id?: number; linkMiniatura?: string; validade?: string; ordem?: number; anexo?: { id?: number; vinculo?: { id?: number } } }>;
    };
  };
  linhaProduto?: { id: number };
  estrutura?: {
    tipoEstoque?: string;
    lancamentoEstoque?: string;
    componentes?: Array<{ id?: number; produto?: { id: number }; quantidade: number }>;
  };
  camposCustomizados?: Array<{ idCampoCustomizado: number; idVinculo?: number; valor?: string; item?: string }>;
  variacoes?: Array<{
    id: number;
    nome?: string;
    codigo?: string;
    preco?: number;
    gtin?: string;
    variacao?: { nome?: string; ordem?: number; cloneInfo?: boolean };
    estoque?: { saldoVirtualTotal?: number };
  }>;
}

// === Tier 4 ===
export interface BlingPedidoVendaListItem {
  id: number;
  numero?: number;
  numeroLoja?: string;
  data: string;
  dataSaida?: string;
  dataPrevista?: string;
  totalProdutos?: number;
  total?: number;
  contato?: { id: number; nome?: string };
  situacao?: { id?: number; valor?: number };
  loja?: { id: number };
}

export interface BlingPedidoVendaFull extends BlingPedidoVendaListItem {
  numeroPedidoCompra?: string;
  outrasDespesas?: number;
  observacoes?: string;
  observacoesInternas?: string;
  desconto?: { valor?: number; unidade?: string };
  categoria?: { id: number };
  notaFiscal?: { id: number };
  tributacao?: { totalICMS?: number; totalIPI?: number };
  itens?: Array<{
    id?: number;
    codigo?: string;
    unidade?: string;
    quantidade: number;
    desconto?: number;
    valor: number;
    aliquotaIPI?: number;
    descricao: string;
    descricaoDetalhada?: string;
    produto?: { id: number };
    comissao?: { base?: number; aliquota?: number; valor?: number };
  }>;
  parcelas?: Array<{
    id?: number;
    dataVencimento: string;
    valor: number;
    observacoes?: string;
    formaPagamento?: { id: number };
  }>;
  transporte?: {
    fretePorConta?: number | string;
    frete?: number;
    quantidadeVolumes?: number;
    pesoBruto?: number;
    prazoEntrega?: number;
    contato?: { id: number; nome?: string };
    etiqueta?: {
      nome?: string;
      endereco?: string;
      numero?: string;
      complemento?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
      bairro?: string;
      nomePais?: string;
    };
    volumes?: Array<{ id?: number; servico: string; codigoRastreamento?: string }>;
  };
  vendedor?: { id: number };
  intermediador?: { cnpj?: string; nomeUsuario?: string };
  taxas?: { taxaComissao?: number; custoFrete?: number; valorBase?: number };
}
