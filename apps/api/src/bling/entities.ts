/**
 * Auto-provision AEX entities for Bling data.
 * Creates bling_* entity schemas on first sync if they don't exist.
 */

import { eq } from "drizzle-orm";
import { entities } from "../db/schema/index.js";
import { serializeFields, type EntityField } from "../db/entity-fields.js";
import type { Database } from "../db/index.js";

interface EntityDef {
  name: string;
  slug: string;
  fields: Omit<EntityField, "id">[];
}

function field(name: string, slug: string, type: EntityField["type"], required = false): Omit<EntityField, "id"> {
  return { name, slug, type, required };
}

const BLING_ENTITIES: EntityDef[] = [
  {
    name: "Bling Contatos",
    slug: "bling_contatos",
    fields: [
      field("Bling ID", "bling_id", "text", true),
      field("Nome", "nome", "text", true),
      field("Tipo", "tipo", "text"),
      field("CPF/CNPJ", "cpf_cnpj", "text"),
      field("Email", "email", "email"),
      field("Telefone", "telefone", "phone"),
      field("Endereco", "endereco", "text"),
      field("Numero", "numero", "text"),
      field("Cidade", "cidade", "text"),
      field("UF", "uf", "text"),
      field("CEP", "cep", "text"),
      field("Situacao", "situacao", "text"),
    ],
  },
  {
    name: "Bling Produtos",
    slug: "bling_produtos",
    fields: [
      field("Bling ID", "bling_id", "text", true),
      field("Nome", "nome", "text", true),
      field("Codigo", "codigo", "text"),
      field("Preco", "preco", "number"),
      field("Preco Custo", "preco_custo", "number"),
      field("Unidade", "unidade", "text"),
      field("Tipo", "tipo", "text"),
      field("Situacao", "situacao", "text"),
      field("Estoque Atual", "estoque_atual", "number"),
    ],
  },
  {
    name: "Bling Pedidos",
    slug: "bling_pedidos",
    fields: [
      field("Bling ID", "bling_id", "text", true),
      field("Numero", "numero", "text"),
      field("Contato ID", "contato_id", "text"),
      field("Contato Nome", "contato_nome", "text"),
      field("Data", "data", "date"),
      field("Valor Total", "valor_total", "number"),
      field("Situacao", "situacao", "text"),
      field("Itens", "itens", "text"),
    ],
  },
  {
    name: "Bling Notas Fiscais",
    slug: "bling_notas_fiscais",
    fields: [
      field("Bling ID", "bling_id", "text", true),
      field("Numero", "numero", "text"),
      field("Serie", "serie", "text"),
      field("Chave Acesso", "chave_acesso", "text"),
      field("Contato Nome", "contato_nome", "text"),
      field("Valor", "valor", "number"),
      field("Situacao", "situacao", "text"),
      field("Tipo", "tipo", "text"),
      field("Data Emissao", "data_emissao", "date"),
    ],
  },
  {
    name: "Bling Contas a Receber",
    slug: "bling_contas_receber",
    fields: [
      field("Bling ID", "bling_id", "text", true),
      field("Contato Nome", "contato_nome", "text"),
      field("Valor", "valor", "number"),
      field("Vencimento", "vencimento", "date"),
      field("Situacao", "situacao", "text"),
      field("Historico", "historico", "text"),
      field("Data Emissao", "data_emissao", "date"),
    ],
  },
  {
    name: "Bling Contas a Pagar",
    slug: "bling_contas_pagar",
    fields: [
      field("Bling ID", "bling_id", "text", true),
      field("Contato Nome", "contato_nome", "text"),
      field("Valor", "valor", "number"),
      field("Vencimento", "vencimento", "date"),
      field("Situacao", "situacao", "text"),
      field("Historico", "historico", "text"),
      field("Data Emissao", "data_emissao", "date"),
    ],
  },
  {
    name: "Bling Estoque",
    slug: "bling_estoque",
    fields: [
      field("Bling ID", "bling_id", "text", true),
      field("Produto Nome", "produto_nome", "text"),
      field("Produto Codigo", "produto_codigo", "text"),
      field("Saldo Fisico", "saldo_fisico", "number"),
      field("Saldo Virtual", "saldo_virtual", "number"),
      field("Deposito", "deposito", "text"),
    ],
  },
];

export async function ensureBlingEntities(db: Database, userId: string): Promise<void> {
  for (const def of BLING_ENTITIES) {
    const [existing] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(eq(entities.slug, def.slug))
      .limit(1);

    if (existing) continue;

    const fields: EntityField[] = def.fields.map((f) => ({
      ...f,
      id: crypto.randomUUID(),
    }));

    await db.insert(entities).values({
      id: crypto.randomUUID(),
      name: def.name,
      slug: def.slug,
      aiContext: `Bling ERP data imported via sync. Entity: ${def.name}`,
      fields: serializeFields(fields),
      createdBy: userId,
    });
  }
}

export async function getBlingEntityId(db: Database, slug: string): Promise<string | null> {
  const [row] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(eq(entities.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

export const BLING_ENTITY_SLUGS = BLING_ENTITIES.map((e) => e.slug);
