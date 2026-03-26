import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../../.env") });

const { db } = await import("../db/index.js");
const { auth } = await import("../auth/index.js");
const { users, conversations, conversationMembers, entities, entityRecords } = await import("../db/schema/index.js");
const { agents } = await import("../db/schema/index.js");
const { eq } = await import("drizzle-orm");
const { DEFAULT_AGENT_ID, DEFAULT_AGENT_NAME, DEFAULT_AGENT_SLUG } = await import("@aex/shared");
const { serializeFields } = await import("../db/entity-fields.js");
import type { EntityField } from "../db/entity-fields.js";

const ADMIN_EMAIL = "admin@aex.app";
const ADMIN_PASSWORD = "admin123";
const ADMIN_NAME = "Admin";

async function seed() {
  console.log("Seeding database...");

  // --- Owner user ---
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    // Ensure existing admin is promoted to owner
    await db
      .update(users)
      .set({ role: "owner" })
      .where(eq(users.email, ADMIN_EMAIL));
    console.log(`Owner user (${ADMIN_EMAIL}) already exists, ensured role=owner.`);
  } else {
    const res = await auth.api.signUpEmail({
      body: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
    });

    if (!res.user) {
      console.error("Failed to create owner user");
      process.exit(1);
    }

    await db
      .update(users)
      .set({ role: "owner" })
      .where(eq(users.id, res.user.id));

    console.log(`Owner user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  }

  // --- Default agent (Eric) ---
  const existingAgent = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.id, DEFAULT_AGENT_ID))
    .limit(1);

  if (existingAgent.length > 0) {
    console.log(`Default agent (${DEFAULT_AGENT_NAME}) already exists, skipping.`);
  } else {
    await db.insert(agents).values({
      id: DEFAULT_AGENT_ID,
      name: DEFAULT_AGENT_NAME,
      slug: DEFAULT_AGENT_SLUG,
      description: "Default AI assistant for RUN ERP",
      systemPrompt: "You are Eric, the default AI assistant inside RUN ERP.",
      isSystem: true,
      createdBy: null,
    });

    console.log(`Default agent created: ${DEFAULT_AGENT_NAME}`);
  }

  // --- Default conversation with Eric ---
  const [adminUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (adminUser) {
    const existingConv = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.agentId, DEFAULT_AGENT_ID))
      .limit(1);

    if (existingConv.length === 0) {
      const convId = crypto.randomUUID();
      await db.insert(conversations).values({
        id: convId,
        name: DEFAULT_AGENT_NAME,
        type: "ai",
        agentId: DEFAULT_AGENT_ID,
      });
      await db.insert(conversationMembers).values({
        conversationId: convId,
        userId: adminUser.id,
      });
      console.log(`Default conversation with ${DEFAULT_AGENT_NAME} created.`);
    } else {
      console.log(`Default conversation with ${DEFAULT_AGENT_NAME} already exists, skipping.`);
    }
  }

  // --- Example entities ---
  await seedEntities(adminUser?.id ?? "system");

  console.log("Seed complete.");
  process.exit(0);
}

async function seedEntities(createdBy: string) {
  const existingEntities = await db.select({ id: entities.id }).from(entities).limit(1);
  if (existingEntities.length > 0) {
    console.log("Entities already exist, skipping entity seed.");
    return;
  }

  const clientesId = crypto.randomUUID();
  const produtosId = crypto.randomUUID();
  const pedidosId = crypto.randomUUID();
  const equipeId = crypto.randomUUID();

  const mkField = (name: string, type: string, extra?: Partial<EntityField>): EntityField => ({
    id: crypto.randomUUID(),
    name,
    slug: name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
    type: type as EntityField["type"],
    required: false,
    ...extra,
  });

  // --- Clientes ---
  const clientesFields: EntityField[] = [
    mkField("Nome", "text", { required: true }),
    mkField("Email", "email"),
    mkField("Telefone", "phone"),
    mkField("Website", "url"),
    mkField("Status", "status", {
      options: [
        { value: "ativo", label: "Ativo", color: "#16a34a" },
        { value: "inativo", label: "Inativo", color: "#dc2626" },
        { value: "prospect", label: "Prospect", color: "#d97706" },
      ],
    }),
    mkField("Observacoes", "long_text"),
    mkField("Avaliacao", "rating", { maxRating: 5 }),
    mkField("Criado em", "created_at"),
  ];

  await db.insert(entities).values({
    id: clientesId,
    name: "Clientes",
    slug: "clientes",
    description: "Cadastro de clientes da empresa",
    fields: serializeFields(clientesFields),
    createdBy,
  });

  const clienteRecords = [
    { nome: "Padaria Estrela do Sul", email: "contato@estreladosul.com.br", telefone: "(11) 3456-7890", website: "https://estreladosul.com.br", status: "ativo", avaliacao: 5 },
    { nome: "Tech Solutions Ltda", email: "comercial@techsolutions.com.br", telefone: "(21) 9876-5432", website: "https://techsolutions.com.br", status: "ativo", avaliacao: 4 },
    { nome: "Maria Fernanda Oliveira", email: "mfernanda@gmail.com", telefone: "(31) 99888-7766", status: "prospect", avaliacao: 3 },
    { nome: "Construtora Horizonte", email: "orcamentos@horizonte.eng.br", telefone: "(41) 3333-2222", website: "https://horizonte.eng.br", status: "ativo", avaliacao: 4 },
    { nome: "Farmacia Popular Central", email: "central@farmpopular.com.br", telefone: "(51) 3211-0099", status: "inativo", avaliacao: 2 },
    { nome: "Restaurante Sabor da Terra", email: "reservas@sabordaterra.com.br", telefone: "(61) 3344-5566", status: "ativo", avaliacao: 5 },
  ];

  for (const rec of clienteRecords) {
    await db.insert(entityRecords).values({
      id: crypto.randomUUID(),
      entityId: clientesId,
      data: JSON.stringify(rec),
      createdBy,
    });
  }
  console.log(`Entity "Clientes" created with ${clienteRecords.length} records.`);

  // --- Produtos ---
  const produtosFields: EntityField[] = [
    mkField("Nome", "text", { required: true }),
    mkField("Descricao", "long_text"),
    mkField("Preco", "currency", { currencyCode: "BRL" }),
    mkField("Categoria", "select", {
      options: [
        { value: "eletronicos", label: "Eletronicos", color: "#2563eb" },
        { value: "roupas", label: "Roupas", color: "#8b5cf6" },
        { value: "alimentos", label: "Alimentos", color: "#16a34a" },
        { value: "servicos", label: "Servicos", color: "#ea580c" },
      ],
    }),
    mkField("Estoque", "number"),
    mkField("Ativo", "checkbox"),
    mkField("SKU", "text", { unique: true }),
    mkField("Codigo de Barras", "barcode"),
  ];

  await db.insert(entities).values({
    id: produtosId,
    name: "Produtos",
    slug: "produtos",
    description: "Catalogo de produtos e servicos",
    fields: serializeFields(produtosFields),
    createdBy,
  });

  const produtoRecords = [
    { nome: "Notebook Dell Inspiron 15", descricao: "Notebook 15.6 polegadas, 16GB RAM, SSD 512GB", preco: 4599.90, categoria: "eletronicos", estoque: 23, ativo: true, sku: "NB-DELL-001", codigo_de_barras: "7891234567890" },
    { nome: "Camiseta Polo Premium", descricao: "Camiseta polo algodao pima, disponivel em 5 cores", preco: 189.90, categoria: "roupas", estoque: 150, ativo: true, sku: "CP-POL-001", codigo_de_barras: "7891234567891" },
    { nome: "Cafe Gourmet 500g", descricao: "Cafe especial torrado e moido, origem Minas Gerais", preco: 45.90, categoria: "alimentos", estoque: 340, ativo: true, sku: "CF-GOU-001", codigo_de_barras: "7891234567892" },
    { nome: "Consultoria Empresarial", descricao: "Pacote de 10 horas de consultoria em gestao", preco: 2500.00, categoria: "servicos", estoque: 0, ativo: true, sku: "SV-CON-001" },
    { nome: "Mouse Logitech MX Master", descricao: "Mouse ergonomico sem fio, sensor 8000 DPI", preco: 649.90, categoria: "eletronicos", estoque: 45, ativo: true, sku: "MS-LOG-001", codigo_de_barras: "7891234567893" },
    { nome: "Jaqueta Corta Vento", descricao: "Jaqueta impermeavel com capuz, tecido ripstop", preco: 299.90, categoria: "roupas", estoque: 67, ativo: true, sku: "JQ-CTV-001", codigo_de_barras: "7891234567894" },
    { nome: "Azeite Extra Virgem 500ml", descricao: "Azeite portugues extra virgem, acidez 0.3%", preco: 59.90, categoria: "alimentos", estoque: 200, ativo: true, sku: "AZ-EXV-001", codigo_de_barras: "7891234567895" },
    { nome: "Teclado Mecanico RGB", descricao: "Teclado mecanico switches brown, iluminacao RGB", preco: 459.90, categoria: "eletronicos", estoque: 0, ativo: false, sku: "TC-MEC-001", codigo_de_barras: "7891234567896" },
  ];

  for (const rec of produtoRecords) {
    await db.insert(entityRecords).values({
      id: crypto.randomUUID(),
      entityId: produtosId,
      data: JSON.stringify(rec),
      createdBy,
    });
  }
  console.log(`Entity "Produtos" created with ${produtoRecords.length} records.`);

  // --- Pedidos ---
  const pedidosFields: EntityField[] = [
    mkField("Numero", "autonumber"),
    mkField("Cliente", "relationship", { relationshipEntityId: clientesId, relationshipEntityName: "Clientes" }),
    mkField("Data", "date"),
    mkField("Total", "currency", { currencyCode: "BRL" }),
    mkField("Status", "status", {
      options: [
        { value: "novo", label: "Novo", color: "#6b7280" },
        { value: "em_processamento", label: "Em Processamento", color: "#2563eb" },
        { value: "enviado", label: "Enviado", color: "#d97706" },
        { value: "entregue", label: "Entregue", color: "#16a34a" },
        { value: "cancelado", label: "Cancelado", color: "#dc2626" },
      ],
    }),
    mkField("Prioridade", "priority", {
      options: [
        { value: "critica", label: "Critica", color: "#dc2626" },
        { value: "alta", label: "Alta", color: "#ea580c" },
        { value: "media", label: "Media", color: "#d97706" },
        { value: "baixa", label: "Baixa", color: "#2563eb" },
      ],
    }),
    mkField("Resumo IA", "ai", { aiPrompt: "Summarize this order based on {total} and {status}" }),
  ];

  await db.insert(entities).values({
    id: pedidosId,
    name: "Pedidos",
    slug: "pedidos",
    description: "Pedidos de venda dos clientes",
    fields: serializeFields(pedidosFields),
    createdBy,
  });

  const pedidoRecords = [
    { numero: 1, cliente: "Padaria Estrela do Sul", data: "2026-03-15", total: 4599.90, status: "entregue", prioridade: "media" },
    { numero: 2, cliente: "Tech Solutions Ltda", data: "2026-03-18", total: 7250.00, status: "em_processamento", prioridade: "alta" },
    { numero: 3, cliente: "Construtora Horizonte", data: "2026-03-19", total: 1899.70, status: "novo", prioridade: "baixa" },
    { numero: 4, cliente: "Restaurante Sabor da Terra", data: "2026-03-20", total: 459.80, status: "enviado", prioridade: "media" },
    { numero: 5, cliente: "Maria Fernanda Oliveira", data: "2026-03-21", total: 189.90, status: "entregue", prioridade: "baixa" },
    { numero: 6, cliente: "Tech Solutions Ltda", data: "2026-03-22", total: 12500.00, status: "novo", prioridade: "critica" },
  ];

  for (const rec of pedidoRecords) {
    await db.insert(entityRecords).values({
      id: crypto.randomUUID(),
      entityId: pedidosId,
      data: JSON.stringify(rec),
      createdBy,
    });
  }
  console.log(`Entity "Pedidos" created with ${pedidoRecords.length} records.`);

  // --- Equipe ---
  const equipeFields: EntityField[] = [
    mkField("Nome", "text", { required: true }),
    mkField("Email", "email"),
    mkField("Cargo", "select", {
      options: [
        { value: "gerente", label: "Gerente", color: "#8b5cf6" },
        { value: "desenvolvedor", label: "Desenvolvedor", color: "#2563eb" },
        { value: "designer", label: "Designer", color: "#ec4899" },
        { value: "analista", label: "Analista", color: "#16a34a" },
      ],
    }),
    mkField("Departamento", "select", {
      options: [
        { value: "engenharia", label: "Engenharia", color: "#2563eb" },
        { value: "comercial", label: "Comercial", color: "#16a34a" },
        { value: "financeiro", label: "Financeiro", color: "#d97706" },
        { value: "rh", label: "RH", color: "#8b5cf6" },
      ],
    }),
    mkField("Data de Admissao", "date"),
    mkField("Salario", "currency", { currencyCode: "BRL" }),
    mkField("Ativo", "checkbox"),
    mkField("Desempenho", "percent"),
  ];

  await db.insert(entities).values({
    id: equipeId,
    name: "Equipe",
    slug: "equipe",
    description: "Membros da equipe e colaboradores",
    fields: serializeFields(equipeFields),
    createdBy,
  });

  const equipeRecords = [
    { nome: "Carlos Eduardo Silva", email: "carlos@empresa.com.br", cargo: "gerente", departamento: "engenharia", data_de_admissao: "2022-03-01", salario: 18500.00, ativo: true, desempenho: 92 },
    { nome: "Ana Paula Santos", email: "ana.paula@empresa.com.br", cargo: "desenvolvedor", departamento: "engenharia", data_de_admissao: "2023-06-15", salario: 12800.00, ativo: true, desempenho: 88 },
    { nome: "Rafael Mendes", email: "rafael.mendes@empresa.com.br", cargo: "designer", departamento: "comercial", data_de_admissao: "2024-01-10", salario: 9500.00, ativo: true, desempenho: 95 },
    { nome: "Juliana Costa", email: "juliana@empresa.com.br", cargo: "analista", departamento: "financeiro", data_de_admissao: "2023-09-01", salario: 11200.00, ativo: true, desempenho: 78 },
    { nome: "Pedro Augusto Lima", email: "pedro.lima@empresa.com.br", cargo: "desenvolvedor", departamento: "engenharia", data_de_admissao: "2024-08-20", salario: 10500.00, ativo: true, desempenho: 85 },
  ];

  for (const rec of equipeRecords) {
    await db.insert(entityRecords).values({
      id: crypto.randomUUID(),
      entityId: equipeId,
      data: JSON.stringify(rec),
      createdBy,
    });
  }
  console.log(`Entity "Equipe" created with ${equipeRecords.length} records.`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
