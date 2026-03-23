/**
 * Bling ERP piece for AEX.
 * Local piece that follows the ActivePieces Piece interface.
 * Provides actions to query Bling API and trigger data sync.
 */

import { PropertyType } from "@activepieces/pieces-framework";
import type { Piece, Action, Trigger } from "@activepieces/pieces-framework";
import {
  getContatos,
  getProdutos,
  getPedidosVendas,
  getNfe,
  getContasReceber,
  getContasPagar,
  getEstoquesSaldos,
  getContatoById,
  getProdutoById,
  getPedidoVendaById,
} from "../../bling/client.js";

// --- Auth type ---

interface BlingAuth {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  expiresAt: number;
}

function getAccessToken(auth: unknown): string {
  if (!auth || typeof auth !== "object") {
    throw new Error("Bling credentials not configured. Connect Bling in Settings first.");
  }
  const a = auth as Record<string, unknown>;
  // Support both direct format and AP OAuth2 format
  return (a.accessToken ?? a.access_token ?? "") as string;
}

// --- Action helpers ---

function shortText(displayName: string, description: string, required = false) {
  return { type: PropertyType.SHORT_TEXT, displayName, description, required };
}

function numberProp(displayName: string, description: string, required = false) {
  return { type: PropertyType.NUMBER, displayName, description, required };
}

function createBlingAction(params: {
  name: string;
  displayName: string;
  description: string;
  props: Record<string, unknown>;
  run: (auth: unknown, props: Record<string, unknown>) => Promise<unknown>;
}): Action {
  return {
    name: params.name,
    displayName: params.displayName,
    description: params.description,
    props: params.props,
    requireAuth: true,
    errorHandlingOptions: undefined,
    run: async (ctx: { auth: unknown; propsValue: Record<string, unknown> }) => {
      return params.run(ctx.auth, ctx.propsValue);
    },
    test: undefined,
  } as unknown as Action;
}

// --- Actions ---

const listContacts = createBlingAction({
  name: "list_contacts",
  displayName: "List Contacts",
  description: "List contacts (customers/suppliers) from Bling ERP. Can filter by name or CPF/CNPJ.",
  props: {
    nome: shortText("Name", "Filter by contact name (partial match)"),
    cpf_cnpj: shortText("CPF/CNPJ", "Filter by CPF or CNPJ"),
  },
  run: async (auth, props) => {
    const token = getAccessToken(auth);
    const contatos = await getContatos(token);
    let filtered = contatos;
    if (props.nome) {
      const q = (props.nome as string).toLowerCase();
      filtered = filtered.filter((c) => c.nome?.toLowerCase().includes(q));
    }
    if (props.cpf_cnpj) {
      const q = (props.cpf_cnpj as string).replace(/\D/g, "");
      filtered = filtered.filter((c) => c.cpfCnpj?.replace(/\D/g, "").includes(q));
    }
    return {
      total: filtered.length,
      contacts: filtered.map((c) => ({
        id: c.id,
        nome: c.nome,
        tipo: c.tipo,
        cpfCnpj: c.cpfCnpj,
        email: c.email,
        telefone: c.telefone ?? c.celular,
        cidade: c.endereco?.municipio,
        uf: c.endereco?.uf,
      })),
    };
  },
});

const getContact = createBlingAction({
  name: "get_contact",
  displayName: "Get Contact",
  description: "Get a specific contact by ID from Bling ERP.",
  props: {
    id: numberProp("Contact ID", "Bling contact ID", true),
  },
  run: async (auth, props) => {
    const token = getAccessToken(auth);
    return getContatoById(token, props.id as number);
  },
});

const listProducts = createBlingAction({
  name: "list_products",
  displayName: "List Products",
  description: "List products from Bling ERP. Can filter by name or product code.",
  props: {
    nome: shortText("Name", "Filter by product name (partial match)"),
    codigo: shortText("Code", "Filter by product code"),
  },
  run: async (auth, props) => {
    const token = getAccessToken(auth);
    const produtos = await getProdutos(token);
    let filtered = produtos;
    if (props.nome) {
      const q = (props.nome as string).toLowerCase();
      filtered = filtered.filter((p) => p.nome?.toLowerCase().includes(q));
    }
    if (props.codigo) {
      const q = (props.codigo as string).toLowerCase();
      filtered = filtered.filter((p) => p.codigo?.toLowerCase().includes(q));
    }
    return {
      total: filtered.length,
      products: filtered.map((p) => ({
        id: p.id,
        nome: p.nome,
        codigo: p.codigo,
        preco: p.preco,
        precoCusto: p.precoCusto,
        unidade: p.unidade,
        tipo: p.tipo,
        situacao: p.situacao,
        estoque: p.estoque?.saldoVirtualTotal,
      })),
    };
  },
});

const getProduct = createBlingAction({
  name: "get_product",
  displayName: "Get Product",
  description: "Get a specific product by ID from Bling ERP.",
  props: {
    id: numberProp("Product ID", "Bling product ID", true),
  },
  run: async (auth, props) => {
    const token = getAccessToken(auth);
    return getProdutoById(token, props.id as number);
  },
});

const listOrders = createBlingAction({
  name: "list_orders",
  displayName: "List Sales Orders",
  description: "List sales orders from Bling ERP. Can filter by customer name, order number, or status.",
  props: {
    contato_nome: shortText("Customer Name", "Filter by customer name"),
    numero: shortText("Order Number", "Filter by order number"),
    situacao: shortText("Status", "Filter by status"),
  },
  run: async (auth, props) => {
    const token = getAccessToken(auth);
    const pedidos = await getPedidosVendas(token);
    let filtered = pedidos;
    if (props.contato_nome) {
      const q = (props.contato_nome as string).toLowerCase();
      filtered = filtered.filter((p) => p.contato?.nome?.toLowerCase().includes(q));
    }
    if (props.numero) {
      const q = String(props.numero);
      filtered = filtered.filter((p) => String(p.numero).includes(q));
    }
    if (props.situacao) {
      const q = (props.situacao as string).toLowerCase();
      filtered = filtered.filter((p) => p.situacao?.valor?.toLowerCase().includes(q));
    }
    return {
      total: filtered.length,
      orders: filtered.map((p) => ({
        id: p.id,
        numero: p.numero,
        contato: p.contato?.nome,
        data: p.data,
        total: p.total,
        situacao: p.situacao?.valor,
      })),
    };
  },
});

const getOrder = createBlingAction({
  name: "get_order",
  displayName: "Get Sales Order",
  description: "Get a specific sales order by ID from Bling ERP, including items.",
  props: {
    id: numberProp("Order ID", "Bling order ID", true),
  },
  run: async (auth, props) => {
    const token = getAccessToken(auth);
    return getPedidoVendaById(token, props.id as number);
  },
});

const listInvoices = createBlingAction({
  name: "list_invoices",
  displayName: "List Invoices (NF-e)",
  description: "List electronic invoices (NF-e) from Bling ERP. Can filter by number or contact name.",
  props: {
    numero: shortText("Invoice Number", "Filter by invoice number"),
    contato_nome: shortText("Contact Name", "Filter by contact name"),
  },
  run: async (auth, props) => {
    const token = getAccessToken(auth);
    const nfes = await getNfe(token);
    let filtered = nfes;
    if (props.numero) {
      const q = String(props.numero);
      filtered = filtered.filter((n) => n.numero?.includes(q));
    }
    if (props.contato_nome) {
      const q = (props.contato_nome as string).toLowerCase();
      filtered = filtered.filter((n) => n.contato?.nome?.toLowerCase().includes(q));
    }
    return {
      total: filtered.length,
      invoices: filtered.map((n) => ({
        id: n.id,
        numero: n.numero,
        serie: n.serie,
        chaveAcesso: n.chaveAcesso,
        contato: n.contato?.nome,
        valor: n.valorNota,
        situacao: n.situacao,
        dataEmissao: n.dataEmissao,
      })),
    };
  },
});

const listReceivables = createBlingAction({
  name: "list_receivables",
  displayName: "List Accounts Receivable",
  description: "List accounts receivable (contas a receber) from Bling ERP.",
  props: {
    contato_nome: shortText("Contact Name", "Filter by contact name"),
  },
  run: async (auth, props) => {
    const token = getAccessToken(auth);
    const contas = await getContasReceber(token);
    let filtered = contas;
    if (props.contato_nome) {
      const q = (props.contato_nome as string).toLowerCase();
      filtered = filtered.filter((c) => c.contato?.nome?.toLowerCase().includes(q));
    }
    return {
      total: filtered.length,
      receivables: filtered.map((c) => ({
        id: c.id,
        contato: c.contato?.nome,
        valor: c.valor,
        vencimento: c.vencimento,
        situacao: c.situacao,
        historico: c.historico,
      })),
    };
  },
});

const listPayables = createBlingAction({
  name: "list_payables",
  displayName: "List Accounts Payable",
  description: "List accounts payable (contas a pagar) from Bling ERP.",
  props: {
    contato_nome: shortText("Contact Name", "Filter by contact name"),
  },
  run: async (auth, props) => {
    const token = getAccessToken(auth);
    const contas = await getContasPagar(token);
    let filtered = contas;
    if (props.contato_nome) {
      const q = (props.contato_nome as string).toLowerCase();
      filtered = filtered.filter((c) => c.contato?.nome?.toLowerCase().includes(q));
    }
    return {
      total: filtered.length,
      payables: filtered.map((c) => ({
        id: c.id,
        contato: c.contato?.nome,
        valor: c.valor,
        vencimento: c.vencimento,
        situacao: c.situacao,
        historico: c.historico,
      })),
    };
  },
});

const listStock = createBlingAction({
  name: "list_stock",
  displayName: "List Stock Balances",
  description: "List stock/inventory balances from Bling ERP. Can filter by product name or code.",
  props: {
    produto_nome: shortText("Product Name", "Filter by product name"),
    produto_codigo: shortText("Product Code", "Filter by product code"),
  },
  run: async (auth, props) => {
    const token = getAccessToken(auth);
    const saldos = await getEstoquesSaldos(token);
    let filtered = saldos;
    if (props.produto_nome) {
      const q = (props.produto_nome as string).toLowerCase();
      filtered = filtered.filter((s) => s.produto?.nome?.toLowerCase().includes(q));
    }
    if (props.produto_codigo) {
      const q = (props.produto_codigo as string).toLowerCase();
      filtered = filtered.filter((s) => s.produto?.codigo?.toLowerCase().includes(q));
    }
    return {
      total: filtered.length,
      stock: filtered.map((s) => ({
        produtoId: s.produto?.id,
        produtoNome: s.produto?.nome,
        produtoCodigo: s.produto?.codigo,
        saldoFisico: s.saldoFisicoTotal,
        saldoVirtual: s.saldoVirtualTotal,
        deposito: s.deposito?.descricao,
      })),
    };
  },
});

const triggerSync = createBlingAction({
  name: "trigger_sync",
  displayName: "Trigger Data Sync",
  description:
    "Trigger an immediate sync of all Bling ERP data into AEX entities. " +
    "Use when the user asks to refresh or import Bling data. " +
    "Data is synced into bling_* entities accessible via query_records.",
  props: {},
  run: async () => {
    const { sql: sqlTag } = await import("drizzle-orm");
    const { db } = await import("../../db/index.js");
    const { integrations } = await import("../../db/schema/index.js");
    const { enqueueBlingSync } = await import("../../queue/bling-queue.js");

    const rows = await db
      .select({ id: integrations.id, status: integrations.status })
      .from(integrations)
      .where(sqlTag`${integrations.slug} LIKE 'bling-%'`);

    const active = rows.filter((r) => r.status === "enabled");
    if (active.length === 0) {
      return { error: "No active Bling integration found. Connect Bling in Settings first." };
    }

    for (const row of active) {
      await enqueueBlingSync(row.id);
    }

    return { queued: true, message: `Sync queued for ${active.length} Bling integration(s).` };
  },
});

// --- Piece definition ---

export const bling: Piece = {
  displayName: "Bling ERP",
  logoUrl: "https://cdn.bling.com.br/images/bling-logo.svg",
  authors: ["AEX"],
  description: "Import and query data from Bling ERP: contacts, products, orders, invoices, financials, and stock.",
  categories: [],
  auth: {
    type: PropertyType.CUSTOM_AUTH,
    displayName: "Bling OAuth2 Credentials",
    description: "Connected via OAuth2 in Settings > Integrations",
    required: true,
    props: {},
  },
  minimumSupportedRelease: "0.0.0",
  events: undefined,
  actions() {
    return {
      list_contacts: listContacts,
      get_contact: getContact,
      list_products: listProducts,
      get_product: getProduct,
      list_orders: listOrders,
      get_order: getOrder,
      list_invoices: listInvoices,
      list_receivables: listReceivables,
      list_payables: listPayables,
      list_stock: listStock,
      trigger_sync: triggerSync,
    };
  },
  triggers() {
    return {};
  },
  metadata() {
    return {
      name: "piece-bling",
      displayName: "Bling ERP",
      description: this.description,
      version: "1.0.0",
      authors: this.authors,
      categories: [],
      minimumSupportedRelease: "0.0.0",
      actions: {},
      triggers: {},
    } as ReturnType<Piece["metadata"]>;
  },
} as unknown as Piece;

export default bling;
