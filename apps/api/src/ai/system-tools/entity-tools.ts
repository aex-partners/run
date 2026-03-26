import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { ToolContext } from "../types.js";
import { entities, entityRecords } from "../../db/schema/index.js";
import { parseFields, serializeFields, slugify, type EntityField } from "../../db/entity-fields.js";
import { broadcast } from "../../ws/index.js";

export function buildEntityTools(ctx: ToolContext) {
  return [
    tool(
      "list_entities",
      "List all data entities (tables) available in the ERP system",
      {},
      async () => {
        const rows = await ctx.db.select().from(entities);
        const result = rows.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          fields: parseFields(e.fields).map((f) => ({ name: f.name, type: f.type })),
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "query_records",
      "Query records from a data entity. Returns matching records.",
      {
        entity_name: z.string().describe("Name or ID of the entity to query"),
        limit: z.number().optional().describe("Max records to return (default 50)"),
      },
      async ({ entity_name, limit }) => {
        const [entity] = await ctx.db
          .select()
          .from(entities)
          .where(eq(entities.name, entity_name))
          .limit(1);

        if (!entity) {
          const [byId] = await ctx.db.select().from(entities).where(eq(entities.id, entity_name)).limit(1);
          if (!byId) return { content: [{ type: "text" as const, text: `Entity "${entity_name}" not found` }], isError: true };
        }

        const entityId = entity?.id ?? entity_name;
        const records = await ctx.db
          .select()
          .from(entityRecords)
          .where(eq(entityRecords.entityId, entityId))
          .limit(limit ?? 50);

        const result = records.map((r) => ({
          id: r.id,
          data: JSON.parse(r.data as string),
        }));

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "create_entity",
      "Create a new data entity (table) in the ERP. Define the name and fields.",
      {
        name: z.string().describe("Entity name (e.g. 'Customers', 'Products')"),
        description: z.string().optional().describe("What this entity represents"),
        fields: z.array(z.object({
          name: z.string(),
          type: z.enum(["text", "number", "date", "email", "phone", "select", "checkbox"]),
          required: z.boolean().optional(),
        })).describe("Fields/columns for this entity"),
      },
      async ({ name, description, fields }) => {
        const entityFields: EntityField[] = fields.map((f) => ({
          id: crypto.randomUUID(),
          name: f.name,
          slug: slugify(f.name),
          type: f.type,
          required: f.required ?? false,
        }));

        const id = crypto.randomUUID();
        await ctx.db.insert(entities).values({
          id,
          name,
          slug: slugify(name),
          description: description ?? null,
          fields: serializeFields(entityFields),
          createdBy: ctx.userId,
        });

        broadcast({ type: "entity_updated", entityId: id });

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, id, name, fieldCount: fields.length }) }],
        };
      },
    ),

    tool(
      "insert_record",
      "Insert a new record into a data entity",
      {
        entity_name: z.string().describe("Name or ID of the entity"),
        data: z.record(z.unknown()).describe("Record data as key-value pairs matching entity fields"),
      },
      async ({ entity_name, data }) => {
        const [entity] = await ctx.db
          .select()
          .from(entities)
          .where(eq(entities.name, entity_name))
          .limit(1);

        if (!entity) {
          return { content: [{ type: "text" as const, text: `Entity "${entity_name}" not found` }], isError: true };
        }

        const id = crypto.randomUUID();
        await ctx.db.insert(entityRecords).values({
          id,
          entityId: entity.id,
          data: JSON.stringify(data),
          createdBy: ctx.userId,
        });

        broadcast({ type: "record_updated", entityId: entity.id });

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, id }) }],
        };
      },
    ),
  ];
}
