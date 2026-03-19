import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { getTestDb, cleanDb, seedTestUser, createToolContext, closeTestDb } from "../test/helpers.js";
import { createTools } from "./tools.js";

// Mock WS module
vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

describe("tools-entity (integration)", () => {
  const db = getTestDb();
  let tools: ReturnType<typeof createTools>;

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);
    tools = createTools(createToolContext(db));
  });

  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "entity_records"`));
    await db.execute(sql.raw(`DELETE FROM "entities"`));
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("create_entity prevents duplicate slug", async () => {
    await tools.create_entity.execute(
      {
        name: "Produtos",
        description: "Product catalog",
        ai_context: "Product catalog for the store",
        fields: [{ name: "Nome", type: "text", required: true }],
      },
      { toolCallId: "tc1" },
    );

    const dup = await tools.create_entity.execute(
      {
        name: "Produtos",
        description: "Duplicate",
        ai_context: "Duplicate",
        fields: [{ name: "Nome", type: "text" }],
      },
      { toolCallId: "tc2" },
    );

    expect(dup.error).toContain("already exists");
  });

  it("create_entity generates correct field IDs and slugs", async () => {
    const result = await tools.create_entity.execute(
      {
        name: "Fornecedores",
        description: "Suppliers",
        ai_context: "Supplier management",
        fields: [
          { name: "Razão Social", type: "text", required: true },
          { name: "CNPJ", type: "text" },
          { name: "Categoria", type: "select", options: ["Nacional", "Importado"] },
        ],
      },
      { toolCallId: "tc3" },
    );

    expect(result.slug).toBe("fornecedores");
    expect(result.fields).toHaveLength(3);
    expect(result.fields[0].name).toBe("Razão Social");
    expect(result.fields[0].type).toBe("text");
    expect(result.fields[0].required).toBe(true);
  });

  it("add_field adds a field to existing entity", async () => {
    const entity = await tools.create_entity.execute(
      {
        name: "Pedidos",
        description: "Orders",
        ai_context: "Order management",
        fields: [{ name: "Numero", type: "text", required: true }],
      },
      { toolCallId: "tc4" },
    );

    const result = await tools.add_field.execute(
      { entity_id: entity.id, name: "Status", type: "select", options: ["Pendente", "Entregue"] },
      { toolCallId: "tc5" },
    );

    expect(result.field.name).toBe("Status");
    expect(result.field.type).toBe("select");
    expect(result.entityId).toBe(entity.id);
  });
});
