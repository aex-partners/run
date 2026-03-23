/**
 * Bling ERP API v3 client with built-in rate limiting.
 * Base URL: https://api.bling.com.br/Api/v3
 * Rate limit: 3 requests/second
 */

const BASE_URL = "https://api.bling.com.br/Api/v3";
const MAX_PER_PAGE = 100;

// --- Rate Limiter (token bucket, 3 req/s) ---

class RateLimiter {
  private queue: Array<() => void> = [];
  private lastCall = 0;
  private processing = false;
  private readonly minGap: number;

  constructor(requestsPerSecond: number) {
    this.minGap = Math.ceil(1000 / requestsPerSecond);
  }

  acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      if (!this.processing) this.process();
    });
  }

  private async process() {
    this.processing = true;
    while (this.queue.length > 0) {
      const now = Date.now();
      const wait = this.lastCall + this.minGap - now;
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCall = Date.now();
      const next = this.queue.shift();
      next?.();
    }
    this.processing = false;
  }
}

const limiter = new RateLimiter(3);

// --- Types ---

export interface BlingContato {
  id: number;
  nome: string;
  tipo: string;
  cpfCnpj?: string;
  ie?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  endereco?: { endereco?: string; numero?: string; bairro?: string; municipio?: string; uf?: string; cep?: string };
  situacao?: string;
}

export interface BlingProduto {
  id: number;
  nome: string;
  codigo?: string;
  preco: number;
  precoCusto?: number;
  unidade?: string;
  tipo?: string;
  situacao?: string;
  estoque?: { saldoVirtualTotal?: number };
}

export interface BlingPedidoVenda {
  id: number;
  numero?: number;
  contato?: { id: number; nome: string };
  data?: string;
  totalProdutos?: number;
  total?: number;
  situacao?: { id: number; valor: string };
  itens?: Array<{ descricao: string; quantidade: number; valor: number }>;
}

export interface BlingNfe {
  id: number;
  numero?: string;
  serie?: string;
  chaveAcesso?: string;
  contato?: { nome: string };
  valorNota?: number;
  situacao?: number;
  tipo?: number;
  dataEmissao?: string;
}

export interface BlingContaReceber {
  id: number;
  contato?: { nome: string };
  valor: number;
  vencimento?: string;
  situacao?: number;
  historico?: string;
  dataEmissao?: string;
}

export interface BlingContaPagar {
  id: number;
  contato?: { nome: string };
  valor: number;
  vencimento?: string;
  situacao?: number;
  historico?: string;
  dataEmissao?: string;
}

export interface BlingEstoqueSaldo {
  produto?: { id: number; nome?: string; codigo?: string };
  saldoFisicoTotal?: number;
  saldoVirtualTotal?: number;
  deposito?: { id: number; descricao?: string };
}

interface BlingPaginatedResponse<T> {
  data: T[];
}

// --- HTTP helpers ---

async function blingFetch<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string | number>,
): Promise<T> {
  await limiter.acquire();

  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new BlingApiError(res.status, body, path);
  }

  return res.json() as Promise<T>;
}

export class BlingApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string,
  ) {
    super(`Bling API error ${status} on ${path}: ${body.slice(0, 200)}`);
    this.name = "BlingApiError";
  }
}

async function paginate<T>(
  path: string,
  accessToken: string,
  extraParams?: Record<string, string | number>,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;

  while (true) {
    const res = await blingFetch<BlingPaginatedResponse<T>>(path, accessToken, {
      ...extraParams,
      pagina: page,
      limite: MAX_PER_PAGE,
    });

    if (!res.data || res.data.length === 0) break;
    all.push(...res.data);
    if (res.data.length < MAX_PER_PAGE) break;
    page++;
  }

  return all;
}

// --- Public API methods ---

export async function getContatos(accessToken: string): Promise<BlingContato[]> {
  return paginate<BlingContato>("/contatos", accessToken);
}

export async function getProdutos(accessToken: string): Promise<BlingProduto[]> {
  return paginate<BlingProduto>("/produtos", accessToken);
}

export async function getPedidosVendas(accessToken: string): Promise<BlingPedidoVenda[]> {
  return paginate<BlingPedidoVenda>("/pedidos/vendas", accessToken);
}

export async function getNfe(accessToken: string): Promise<BlingNfe[]> {
  return paginate<BlingNfe>("/nfe", accessToken);
}

export async function getContasReceber(accessToken: string): Promise<BlingContaReceber[]> {
  return paginate<BlingContaReceber>("/contas/receber", accessToken);
}

export async function getContasPagar(accessToken: string): Promise<BlingContaPagar[]> {
  return paginate<BlingContaPagar>("/contas/pagar", accessToken);
}

export async function getEstoquesSaldos(accessToken: string): Promise<BlingEstoqueSaldo[]> {
  return paginate<BlingEstoqueSaldo>("/estoques/saldos", accessToken);
}

export async function getContatoById(accessToken: string, id: number): Promise<BlingContato> {
  const res = await blingFetch<{ data: BlingContato }>(`/contatos/${id}`, accessToken);
  return res.data;
}

export async function getProdutoById(accessToken: string, id: number): Promise<BlingProduto> {
  const res = await blingFetch<{ data: BlingProduto }>(`/produtos/${id}`, accessToken);
  return res.data;
}

export async function getPedidoVendaById(accessToken: string, id: number): Promise<BlingPedidoVenda> {
  const res = await blingFetch<{ data: BlingPedidoVenda }>(`/pedidos/vendas/${id}`, accessToken);
  return res.data;
}
