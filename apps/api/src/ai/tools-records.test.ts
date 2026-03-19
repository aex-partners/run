import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { getTestDb, cleanDb, seedTestUser, createToolContext, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import { createTools } from "./tools.js";
import * as schema from "../db/schema/index.js";
import { serializeFields, type EntityField } from "../db/entity-fields.js";

// Mock WS module
vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

const ENTITY_ID = "ent-clientes-001";

const clienteFields: EntityField[] = [
  { id: "f1", name: "Nome", slug: "nome", type: "text", required: true },
  { id: "f2", name: "CPF/CNPJ", slug: "cpf_cnpj", type: "text", required: false, unique: true },
  { id: "f3", name: "Email", slug: "email", type: "email", required: false },
  { id: "f4", name: "Cidade", slug: "cidade", type: "text", required: false },
  { id: "f5", name: "Telefone", slug: "telefone", type: "phone", required: false },
];

async function seedEntity(db: ReturnType<typeof getTestDb>) {
  await db.insert(schema.entities).values({
    id: ENTITY_ID,
    name: "Clientes",
    slug: "clientes",
    description: "Cadastro de clientes",
    fields: serializeFields(clienteFields),
    createdBy: TEST_USER_ID,
  }).onConflictDoNothing();
}

describe("tools-records (integration)", () => {
  const db = getTestDb();
  let tools: ReturnType<typeof createTools>;

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);
    await seedEntity(db);
    tools = createTools(createToolContext(db));
  });

  beforeEach(async () => {
    // Clean only records between tests, keep entity + user
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "entity_records"`));
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("insert_record resolves entity by name (case-insensitive)", async () => {
    const result = await tools.insert_record.execute(
      { entity_id_or_name: "clientes", data: { Nome: "CTG Tropeiro Velho", Cidade: "Porto Alegre" } },
      { toolCallId: "tc1" },
    );
    expect(result.id).toBeDefined();
    expect(result.entity).toBe("Clientes");
  });

  it("insert_record resolves by slug", async () => {
    const result = await tools.insert_record.execute(
      { entity_id_or_name: "clientes", data: { Nome: "CTG Tropeiro Velho" } },
      { toolCallId: "tc2" },
    );
    expect(result.entity).toBe("Clientes");
  });

  it("dedup by unique field (CPF/CNPJ)", async () => {
    await tools.insert_record.execute(
      { entity_id_or_name: "clientes", data: { Nome: "CTG Tropeiro Velho", "CPF/CNPJ": "12.345.678/0001-99" } },
      { toolCallId: "tc3" },
    );

    const dup = await tools.insert_record.execute(
      { entity_id_or_name: "clientes", data: { Nome: "Outro Nome", "CPF/CNPJ": "12.345.678/0001-99" } },
      { toolCallId: "tc4" },
    );

    expect(dup.error).toContain("Duplicate");
    expect(dup.existingRecordId).toBeDefined();
  });

  it("dedup by name field", async () => {
    await tools.insert_record.execute(
      { entity_id_or_name: "clientes", data: { Nome: "CTG Tropeiro Velho" } },
      { toolCallId: "tc5" },
    );

    const dup = await tools.insert_record.execute(
      { entity_id_or_name: "clientes", data: { Nome: "CTG Tropeiro Velho" } },
      { toolCallId: "tc6" },
    );

    expect(dup.error).toContain("Duplicate");
  });

  it("dedup is case-insensitive for name", async () => {
    await tools.insert_record.execute(
      { entity_id_or_name: "clientes", data: { Nome: "CTG Tropeiro Velho" } },
      { toolCallId: "tc7" },
    );

    const dup = await tools.insert_record.execute(
      { entity_id_or_name: "clientes", data: { Nome: "ctg tropeiro velho" } },
      { toolCallId: "tc8" },
    );

    expect(dup.error).toContain("Duplicate");
  });

  it("normalizes field names to slugs", async () => {
    const result = await tools.insert_record.execute(
      { entity_id_or_name: "clientes", data: { Nome: "Teste", "CPF/CNPJ": "111.222.333-44" } },
      { toolCallId: "tc9" },
    );

    expect(result.data).toBeDefined();
    expect(result.data.cpf_cnpj).toBe("111.222.333-44");
  });

  it("validates required fields", async () => {
    const result = await tools.insert_record.execute(
      { entity_id_or_name: "clientes", data: { Cidade: "Curitiba" } },
      { toolCallId: "tc10" },
    );

    expect(result.error).toContain("Nome");
  });

  it("update_record merges data partially", async () => {
    const inserted = await tools.insert_record.execute(
      { entity_id_or_name: "clientes", data: { Nome: "CTG Tropeiro Velho", Email: "ctg@email.com" } },
      { toolCallId: "tc11" },
    );

    const updated = await tools.update_record.execute(
      { record_id: inserted.id, data: { Telefone: "(51) 99999-0000" } },
      { toolCallId: "tc12" },
    );

    expect(updated.data.nome).toBe("CTG Tropeiro Velho");
    expect(updated.data.email).toBe("ctg@email.com");
    expect(updated.data.telefone).toBe("(51) 99999-0000");
  });

  it("update_record on non-existent record returns error", async () => {
    const result = await tools.update_record.execute(
      { record_id: "nonexistent-id", data: { Nome: "Test" } },
      { toolCallId: "tc13" },
    );

    expect(result.error).toContain("not found");
  });

  it("delete_record removes the record", async () => {
    const inserted = await tools.insert_record.execute(
      { entity_id_or_name: "clientes", data: { Nome: "A Deletar" } },
      { toolCallId: "tc14" },
    );

    const delResult = await tools.delete_record.execute(
      { record_id: inserted.id },
      { toolCallId: "tc15" },
    );
    expect(delResult.deleted).toBe(true);

    const query = await tools.query_records.execute(
      { entity_id_or_name: "clientes" },
      { toolCallId: "tc16" },
    );
    expect(query.count).toBe(0);
  });
});
