import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, seedTestUser, closeTestDb, TEST_USER_ID } from "../../test/helpers.js";
import * as schema from "../../db/schema/index.js";
import { serializeFields, type EntityField } from "../../db/entity-fields.js";
import { buildEntityTools } from "./entity-tools.js";
import type { ToolContext } from "../types.js";

vi.mock("../../ws/index.js", () => ({
  broadcast: vi.fn(),
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  registerWebSocket: vi.fn(),
}));

const ENTITY_ID = "ent-entity-tools-test";
const OTHER_ENTITY_ID = "ent-entity-tools-other";

const fields: EntityField[] = [
  { id: "f-name", name: "Nome", slug: "nome", type: "text", required: true },
  { id: "f-price", name: "Preço", slug: "preco", type: "number", required: false },
  { id: "f-email", name: "Email", slug: "email", type: "email", required: false },
];

type ToolDef = ReturnType<typeof buildEntityTools>[number];
function getTool(tools: ToolDef[], name: string): ToolDef {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`Tool ${name} not found`);
  return t;
}

function parseResult(result: Awaited<ReturnType<ToolDef["handler"]>>) {
  const first = result.content[0];
  if (first.type !== "text") throw new Error("Expected text content");
  return { text: first.text, isError: result.isError === true };
}

describe("entity-tools update_record / delete_record", () => {
  const db = getTestDb();
  const ctx: ToolContext = { db, userId: TEST_USER_ID, conversationId: "test-conv" };
  const tools = buildEntityTools(ctx);
  const updateTool = getTool(tools, "update_record");
  const deleteTool = getTool(tools, "delete_record");

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);
  });

  beforeEach(async () => {
    await db.delete(schema.entityRecords);
    await db.delete(schema.entities);

    await db.insert(schema.entities).values([
      {
        id: ENTITY_ID,
        name: "Clientes",
        slug: "clientes",
        fields: serializeFields(fields),
        createdBy: TEST_USER_ID,
      },
      {
        id: OTHER_ENTITY_ID,
        name: "Produtos",
        slug: "produtos",
        fields: serializeFields(fields),
        createdBy: TEST_USER_ID,
      },
    ]);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("update_record", () => {
    it("merges provided fields with existing data", async () => {
      const recordId = crypto.randomUUID();
      await db.insert(schema.entityRecords).values({
        id: recordId,
        entityId: ENTITY_ID,
        data: JSON.stringify({ nome: "Ana", preco: 100, email: "ana@example.com" }),
        createdBy: TEST_USER_ID,
      });

      const res = await updateTool.handler(
        { entity_name: "Clientes", record_id: recordId, data: { preco: 150 } },
        {},
      );

      const { text, isError } = parseResult(res);
      expect(isError).toBe(false);
      expect(JSON.parse(text)).toMatchObject({ success: true, id: recordId, fields_updated: "preco" });

      const [row] = await db.select().from(schema.entityRecords).where(eq(schema.entityRecords.id, recordId));
      expect(JSON.parse(row.data)).toEqual({ nome: "Ana", preco: 150, email: "ana@example.com" });
    });

    it("maps field name to slug when keys use display names", async () => {
      const recordId = crypto.randomUUID();
      await db.insert(schema.entityRecords).values({
        id: recordId,
        entityId: ENTITY_ID,
        data: JSON.stringify({ nome: "Ana" }),
        createdBy: TEST_USER_ID,
      });

      await updateTool.handler(
        { entity_name: "Clientes", record_id: recordId, data: { "Preço": 200, Email: "a@b.com" } },
        {},
      );

      const [row] = await db.select().from(schema.entityRecords).where(eq(schema.entityRecords.id, recordId));
      expect(JSON.parse(row.data)).toEqual({ nome: "Ana", preco: 200, email: "a@b.com" });
    });

    it("returns error when entity does not exist", async () => {
      const res = await updateTool.handler(
        { entity_name: "NonExistent", record_id: "anything", data: { nome: "X" } },
        {},
      );
      const { text, isError } = parseResult(res);
      expect(isError).toBe(true);
      expect(text).toMatch(/Entity "NonExistent" not found/);
    });

    it("returns error when record does not exist", async () => {
      const res = await updateTool.handler(
        { entity_name: "Clientes", record_id: "nonexistent-id", data: { nome: "X" } },
        {},
      );
      const { text, isError } = parseResult(res);
      expect(isError).toBe(true);
      expect(text).toMatch(/Record "nonexistent-id" not found/);
    });

    it("returns error when record belongs to a different entity", async () => {
      const recordId = crypto.randomUUID();
      await db.insert(schema.entityRecords).values({
        id: recordId,
        entityId: OTHER_ENTITY_ID,
        data: JSON.stringify({ nome: "Widget" }),
        createdBy: TEST_USER_ID,
      });

      const res = await updateTool.handler(
        { entity_name: "Clientes", record_id: recordId, data: { nome: "Changed" } },
        {},
      );
      const { text, isError } = parseResult(res);
      expect(isError).toBe(true);
      expect(text).toMatch(/does not belong to entity "Clientes"/);
    });
  });

  describe("delete_record", () => {
    it("deletes a record that belongs to the entity", async () => {
      const recordId = crypto.randomUUID();
      await db.insert(schema.entityRecords).values({
        id: recordId,
        entityId: ENTITY_ID,
        data: JSON.stringify({ nome: "Ana" }),
        createdBy: TEST_USER_ID,
      });

      const res = await deleteTool.handler(
        { entity_name: "Clientes", record_id: recordId },
        {},
      );
      const { text, isError } = parseResult(res);
      expect(isError).toBe(false);
      expect(JSON.parse(text)).toMatchObject({ success: true, id: recordId });

      const rows = await db.select().from(schema.entityRecords).where(eq(schema.entityRecords.id, recordId));
      expect(rows).toHaveLength(0);
    });

    it("returns error when record belongs to a different entity", async () => {
      const recordId = crypto.randomUUID();
      await db.insert(schema.entityRecords).values({
        id: recordId,
        entityId: OTHER_ENTITY_ID,
        data: JSON.stringify({ nome: "Widget" }),
        createdBy: TEST_USER_ID,
      });

      const res = await deleteTool.handler(
        { entity_name: "Clientes", record_id: recordId },
        {},
      );
      const { text, isError } = parseResult(res);
      expect(isError).toBe(true);
      expect(text).toMatch(/does not belong to entity "Clientes"/);

      const rows = await db.select().from(schema.entityRecords).where(eq(schema.entityRecords.id, recordId));
      expect(rows).toHaveLength(1);
    });

    it("returns error when record does not exist", async () => {
      const res = await deleteTool.handler(
        { entity_name: "Clientes", record_id: "missing-id" },
        {},
      );
      const { text, isError } = parseResult(res);
      expect(isError).toBe(true);
      expect(text).toMatch(/Record "missing-id" not found/);
    });

    it("accepts entity ID in addition to entity name", async () => {
      const recordId = crypto.randomUUID();
      await db.insert(schema.entityRecords).values({
        id: recordId,
        entityId: ENTITY_ID,
        data: JSON.stringify({ nome: "Ana" }),
        createdBy: TEST_USER_ID,
      });

      const res = await deleteTool.handler(
        { entity_name: ENTITY_ID, record_id: recordId },
        {},
      );
      expect(parseResult(res).isError).toBe(false);
    });
  });
});
