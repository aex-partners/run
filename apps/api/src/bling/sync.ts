/**
 * Bling data sync orchestration.
 * Fetches data from Bling API and upserts into AEX entity records.
 */

import { eq, sql } from "drizzle-orm";
import { integrations, entityRecords } from "../db/schema/index.js";
import { decryptCredentials, encryptCredentials } from "../integrations/crypto.js";
import { refreshBlingToken } from "./oauth.js";
import { ensureBlingEntities, getBlingEntityId } from "./entities.js";
import {
  getContatos,
  getProdutos,
  getPedidosVendas,
  getNfe,
  getContasReceber,
  getContasPagar,
  getEstoquesSaldos,
  BlingApiError,
} from "./client.js";
import type { Database } from "../db/index.js";

interface BlingCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface SyncStats {
  contatos: number;
  produtos: number;
  pedidos: number;
  notasFiscais: number;
  contasReceber: number;
  contasPagar: number;
  estoque: number;
}

async function refreshTokenIfNeeded(
  db: Database,
  integrationId: string,
  creds: BlingCredentials,
): Promise<string> {
  if (Date.now() < creds.expiresAt - 60_000) {
    return creds.accessToken;
  }

  console.log("[bling-sync] Refreshing token...");
  const tokens = await refreshBlingToken(creds.clientId, creds.clientSecret, creds.refreshToken);
  const updated: BlingCredentials = {
    ...creds,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };

  await db
    .update(integrations)
    .set({ credentials: encryptCredentials(updated), updatedAt: new Date() })
    .where(eq(integrations.id, integrationId));

  return tokens.accessToken;
}

async function upsertRecords(
  db: Database,
  entityId: string,
  records: Array<{ blingId: string; data: Record<string, unknown> }>,
  createdBy: string,
): Promise<number> {
  if (records.length === 0) return 0;

  // Batch lookup: fetch all existing bling_ids for this entity in one query
  const blingIds = records.map((r) => r.blingId);
  const existingRows = await db
    .select({ id: entityRecords.id, blingId: sql<string>`${entityRecords.data}::jsonb->>'bling_id'` })
    .from(entityRecords)
    .where(
      sql`${entityRecords.entityId} = ${entityId} AND ${entityRecords.data}::jsonb->>'bling_id' = ANY(${blingIds})`,
    );

  const existingMap = new Map(existingRows.map((r) => [r.blingId, r.id]));
  let newCount = 0;

  for (const rec of records) {
    const dataJson = JSON.stringify(rec.data);
    const existingId = existingMap.get(rec.blingId);

    if (existingId) {
      await db
        .update(entityRecords)
        .set({ data: dataJson, updatedAt: new Date() })
        .where(eq(entityRecords.id, existingId));
    } else {
      await db.insert(entityRecords).values({
        id: crypto.randomUUID(),
        entityId,
        data: dataJson,
        createdBy,
      });
      newCount++;
    }
  }

  return newCount;
}

export async function syncBlingData(db: Database, integrationId: string): Promise<SyncStats> {
  // Load integration
  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, integrationId))
    .limit(1);

  if (!integration) throw new Error(`Integration ${integrationId} not found`);
  if (integration.status !== "enabled") throw new Error("Integration is disabled");

  const creds = decryptCredentials(integration.credentials!) as BlingCredentials;
  const accessToken = await refreshTokenIfNeeded(db, integrationId, creds);
  const config = integration.config ? JSON.parse(integration.config) : {};
  const createdBy = integration.createdBy ?? "system";

  // Ensure entities exist
  await ensureBlingEntities(db, createdBy);

  const stats: SyncStats = {
    contatos: 0,
    produtos: 0,
    pedidos: 0,
    notasFiscais: 0,
    contasReceber: 0,
    contasPagar: 0,
    estoque: 0,
  };

  // Sync contacts
  try {
    const entityId = await getBlingEntityId(db, "bling_contatos");
    if (entityId) {
      const contatos = await getContatos(accessToken);
      stats.contatos = await upsertRecords(
        db,
        entityId,
        contatos.map((c) => ({
          blingId: String(c.id),
          data: {
            bling_id: String(c.id),
            nome: c.nome,
            tipo: c.tipo ?? "",
            cpf_cnpj: c.cpfCnpj ?? "",
            email: c.email ?? "",
            telefone: c.telefone ?? c.celular ?? "",
            endereco: c.endereco?.endereco ?? "",
            numero: c.endereco?.numero ?? "",
            cidade: c.endereco?.municipio ?? "",
            uf: c.endereco?.uf ?? "",
            cep: c.endereco?.cep ?? "",
            situacao: c.situacao ?? "",
          },
        })),
        createdBy,
      );
      console.log(`[bling-sync] Contacts: ${contatos.length} fetched, ${stats.contatos} new`);
    }
  } catch (err) {
    console.error("[bling-sync] Error syncing contacts:", err instanceof BlingApiError ? err.message : err);
  }

  // Sync products
  try {
    const entityId = await getBlingEntityId(db, "bling_produtos");
    if (entityId) {
      const produtos = await getProdutos(accessToken);
      stats.produtos = await upsertRecords(
        db,
        entityId,
        produtos.map((p) => ({
          blingId: String(p.id),
          data: {
            bling_id: String(p.id),
            nome: p.nome,
            codigo: p.codigo ?? "",
            preco: p.preco ?? 0,
            preco_custo: p.precoCusto ?? 0,
            unidade: p.unidade ?? "",
            tipo: p.tipo ?? "",
            situacao: p.situacao ?? "",
            estoque_atual: p.estoque?.saldoVirtualTotal ?? 0,
          },
        })),
        createdBy,
      );
      console.log(`[bling-sync] Products: ${produtos.length} fetched, ${stats.produtos} new`);
    }
  } catch (err) {
    console.error("[bling-sync] Error syncing products:", err instanceof BlingApiError ? err.message : err);
  }

  // Sync sales orders
  try {
    const entityId = await getBlingEntityId(db, "bling_pedidos");
    if (entityId) {
      const pedidos = await getPedidosVendas(accessToken);
      stats.pedidos = await upsertRecords(
        db,
        entityId,
        pedidos.map((p) => ({
          blingId: String(p.id),
          data: {
            bling_id: String(p.id),
            numero: p.numero ? String(p.numero) : "",
            contato_id: p.contato ? String(p.contato.id) : "",
            contato_nome: p.contato?.nome ?? "",
            data: p.data ?? "",
            valor_total: p.total ?? p.totalProdutos ?? 0,
            situacao: p.situacao?.valor ?? "",
            itens: p.itens ? JSON.stringify(p.itens) : "[]",
          },
        })),
        createdBy,
      );
      console.log(`[bling-sync] Orders: ${pedidos.length} fetched, ${stats.pedidos} new`);
    }
  } catch (err) {
    console.error("[bling-sync] Error syncing orders:", err instanceof BlingApiError ? err.message : err);
  }

  // Sync invoices (NF-e)
  try {
    const entityId = await getBlingEntityId(db, "bling_notas_fiscais");
    if (entityId) {
      const nfes = await getNfe(accessToken);
      stats.notasFiscais = await upsertRecords(
        db,
        entityId,
        nfes.map((n) => ({
          blingId: String(n.id),
          data: {
            bling_id: String(n.id),
            numero: n.numero ?? "",
            serie: n.serie ?? "",
            chave_acesso: n.chaveAcesso ?? "",
            contato_nome: n.contato?.nome ?? "",
            valor: n.valorNota ?? 0,
            situacao: n.situacao != null ? String(n.situacao) : "",
            tipo: n.tipo != null ? String(n.tipo) : "",
            data_emissao: n.dataEmissao ?? "",
          },
        })),
        createdBy,
      );
      console.log(`[bling-sync] Invoices: ${nfes.length} fetched, ${stats.notasFiscais} new`);
    }
  } catch (err) {
    console.error("[bling-sync] Error syncing invoices:", err instanceof BlingApiError ? err.message : err);
  }

  // Sync accounts receivable
  try {
    const entityId = await getBlingEntityId(db, "bling_contas_receber");
    if (entityId) {
      const contas = await getContasReceber(accessToken);
      stats.contasReceber = await upsertRecords(
        db,
        entityId,
        contas.map((c) => ({
          blingId: String(c.id),
          data: {
            bling_id: String(c.id),
            contato_nome: c.contato?.nome ?? "",
            valor: c.valor ?? 0,
            vencimento: c.vencimento ?? "",
            situacao: c.situacao != null ? String(c.situacao) : "",
            historico: c.historico ?? "",
            data_emissao: c.dataEmissao ?? "",
          },
        })),
        createdBy,
      );
      console.log(`[bling-sync] Receivables: ${contas.length} fetched, ${stats.contasReceber} new`);
    }
  } catch (err) {
    console.error("[bling-sync] Error syncing receivables:", err instanceof BlingApiError ? err.message : err);
  }

  // Sync accounts payable
  try {
    const entityId = await getBlingEntityId(db, "bling_contas_pagar");
    if (entityId) {
      const contas = await getContasPagar(accessToken);
      stats.contasPagar = await upsertRecords(
        db,
        entityId,
        contas.map((c) => ({
          blingId: String(c.id),
          data: {
            bling_id: String(c.id),
            contato_nome: c.contato?.nome ?? "",
            valor: c.valor ?? 0,
            vencimento: c.vencimento ?? "",
            situacao: c.situacao != null ? String(c.situacao) : "",
            historico: c.historico ?? "",
            data_emissao: c.dataEmissao ?? "",
          },
        })),
        createdBy,
      );
      console.log(`[bling-sync] Payables: ${contas.length} fetched, ${stats.contasPagar} new`);
    }
  } catch (err) {
    console.error("[bling-sync] Error syncing payables:", err instanceof BlingApiError ? err.message : err);
  }

  // Sync stock balances
  try {
    const entityId = await getBlingEntityId(db, "bling_estoque");
    if (entityId) {
      const saldos = await getEstoquesSaldos(accessToken);
      stats.estoque = await upsertRecords(
        db,
        entityId,
        saldos.map((s) => ({
          blingId: String(s.produto?.id ?? 0),
          data: {
            bling_id: String(s.produto?.id ?? 0),
            produto_nome: s.produto?.nome ?? "",
            produto_codigo: s.produto?.codigo ?? "",
            saldo_fisico: s.saldoFisicoTotal ?? 0,
            saldo_virtual: s.saldoVirtualTotal ?? 0,
            deposito: s.deposito?.descricao ?? "",
          },
        })),
        createdBy,
      );
      console.log(`[bling-sync] Stock: ${saldos.length} fetched, ${stats.estoque} new`);
    }
  } catch (err) {
    console.error("[bling-sync] Error syncing stock:", err instanceof BlingApiError ? err.message : err);
  }

  // Update lastSyncAt
  const updatedConfig = { ...config, lastSyncAt: new Date().toISOString() };
  await db
    .update(integrations)
    .set({ config: JSON.stringify(updatedConfig), updatedAt: new Date() })
    .where(eq(integrations.id, integrationId));

  return stats;
}
