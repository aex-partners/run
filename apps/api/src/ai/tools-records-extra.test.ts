import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, seedTestUser, createToolContext, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import { createTools } from "./tools.js";
import * as schema from "../db/schema/index.js";
import { serializeFields, type EntityField } from "../db/entity-fields.js";

vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

const db = getTestDb();
let tools: ReturnType<typeof createTools>;
const ENTITY_ID = "ent-dedup-edge-001";

const fields: EntityField[] = [
  { id: "f1", name: "Nome", slug: "nome", type: "text", required: true },
  { id: "f2", name: "Codigo", slug: "codigo", type: "text", required: false, unique: true },
];

beforeAll(async () => {
  await cleanDb();
  await seedTestUser(db);
  await db.insert(schema.entities).values({
    id: ENTITY_ID,
    name: "DedupTest",
    slug: "deduptest",
    fields: serializeFields(fields),
    createdBy: TEST_USER_ID,
  });
  tools = createTools(createToolContext(db));
});

afterAll(async () => {
  await closeTestDb();
});

describe("insert_record dedup edge cases", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "entity_records"`));
  });

  it("unique check is case-insensitive", async () => {
    await tools.insert_record.execute(
      { entity_id_or_name: "deduptest", data: { Nome: "A", Codigo: "ABC-123" } },
      { toolCallId: "tc1" },
    );

    const dup = await tools.insert_record.execute(
      { entity_id_or_name: "deduptest", data: { Nome: "B", Codigo: "abc-123" } },
      { toolCallId: "tc2" },
    );
    expect(dup.error).toContain("Duplicate");
  });

  it("name dedup triggers even without unique fields", async () => {
    // Use an entity without unique fields
    const noUniqId = "ent-no-uniq-001";
    const noUniqFields: EntityField[] = [
      { id: "f1", name: "Nome", slug: "nome", type: "text", required: true },
      { id: "f2", name: "Desc", slug: "desc", type: "text", required: false },
    ];
    await db.insert(schema.entities).values({
      id: noUniqId,
      name: "NoUnique",
      slug: "nounique",
      fields: serializeFields(noUniqFields),
      createdBy: TEST_USER_ID,
    }).onConflictDoNothing();

    await tools.insert_record.execute(
      { entity_id_or_name: "nounique", data: { Nome: "Duplicated Name" } },
      { toolCallId: "tc3" },
    );

    const dup = await tools.insert_record.execute(
      { entity_id_or_name: "nounique", data: { Nome: "duplicated name" } },
      { toolCallId: "tc4" },
    );
    expect(dup.error).toContain("Duplicate");
  });

  it("allows different names even with same non-unique fields", async () => {
    await tools.insert_record.execute(
      { entity_id_or_name: "deduptest", data: { Nome: "Empresa A", Codigo: "001" } },
      { toolCallId: "tc5" },
    );

    const result = await tools.insert_record.execute(
      { entity_id_or_name: "deduptest", data: { Nome: "Empresa B", Codigo: "002" } },
      { toolCallId: "tc6" },
    );
    expect(result.id).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it("resolveEntity returns null for nonexistent entity", async () => {
    const result = await tools.insert_record.execute(
      { entity_id_or_name: "entidade_fantasma", data: { Nome: "Test" } },
      { toolCallId: "tc7" },
    );
    expect(result.error).toContain("not found");
  });

  it("query_records returns error for nonexistent entity", async () => {
    const result = await tools.query_records.execute(
      { entity_id_or_name: "nao_existe" },
      { toolCallId: "tc8" },
    );
    expect(result.error).toContain("not found");
  });

  it("delete_record returns error for nonexistent record", async () => {
    const result = await tools.delete_record.execute(
      { record_id: "nonexistent-record-id" },
      { toolCallId: "tc9" },
    );
    expect(result.error).toContain("not found");
  });
});

describe("resolveEntity resolution order", () => {
  it("resolves by ID first, then slug, then name (ilike)", async () => {
    // Create entity and query by exact ID
    const entityId = "ent-resolve-order-001";
    await db.insert(schema.entities).values({
      id: entityId,
      name: "Clientes Especiais",
      slug: "clientes_especiais",
      fields: serializeFields([{ id: "f1", name: "Nome", slug: "nome", type: "text", required: true }]),
      createdBy: TEST_USER_ID,
    }).onConflictDoNothing();

    // By ID
    const byId = await tools.query_records.execute(
      { entity_id_or_name: entityId },
      { toolCallId: "tc10" },
    );
    expect(byId.entity).toBe("Clientes Especiais");

    // By slug
    const bySlug = await tools.query_records.execute(
      { entity_id_or_name: "clientes_especiais" },
      { toolCallId: "tc11" },
    );
    expect(bySlug.entity).toBe("Clientes Especiais");

    // By name (case-insensitive)
    const byName = await tools.query_records.execute(
      { entity_id_or_name: "Clientes Especiais" },
      { toolCallId: "tc12" },
    );
    expect(byName.entity).toBe("Clientes Especiais");

    // Cleanup
    await db.delete(schema.entities).where(eq(schema.entities.id, entityId));
  });
});
