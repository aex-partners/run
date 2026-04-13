import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import type { ToolContext } from "../types.js";
import { entities, entityRecords } from "../../db/schema/index.js";
import { parseFields, serializeFields, slugify, type EntityField } from "../../db/entity-fields.js";
import { broadcast } from "../../ws/index.js";

type Entity = typeof entities.$inferSelect;

async function resolveEntity(db: ToolContext["db"], nameOrId: string): Promise<Entity | null> {
  const [match] = await db
    .select()
    .from(entities)
    .where(or(eq(entities.name, nameOrId), eq(entities.id, nameOrId)))
    .limit(1);
  return match ?? null;
}

function mapDataKeysToFieldSlugs(
  data: Record<string, unknown>,
  fields: EntityField[],
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const keySlug = slugify(key);
    const matched = fields.find(
      (f) => f.name === key || f.slug === key || f.slug === keySlug || f.name.toLowerCase() === key.toLowerCase(),
    );
    mapped[matched ? matched.slug : keySlug] = value;
  }
  return mapped;
}

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
          fields: parseFields(e.fields).map((f) => ({ name: f.name, slug: f.slug, type: f.type })),
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
      "Insert a new record into a data entity. Use the field names from list_entities as keys. The system maps them automatically.",
      {
        entity_name: z.string().describe("Name or ID of the entity"),
        data: z.record(z.unknown()).describe("Record data as key-value pairs. Keys MUST match the entity's field names exactly (use list_entities to check)."),
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

        // Map input keys to field slugs (the DataGrid reads by slug)
        const fields = parseFields(entity.fields);
        const mappedData: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(data)) {
          const keySlug = slugify(key);
          // Match by name, slug, or case-insensitive name
          const matchedField = fields.find(
            (f) => f.name === key || f.slug === key || f.slug === keySlug || f.name.toLowerCase() === key.toLowerCase(),
          );
          if (matchedField) {
            // Always store by slug (DataGrid reads by slug)
            mappedData[matchedField.slug] = value;
          } else {
            mappedData[keySlug] = value;
          }
        }

        const id = crypto.randomUUID();
        await ctx.db.insert(entityRecords).values({
          id,
          entityId: entity.id,
          data: JSON.stringify(mappedData),
          createdBy: ctx.userId,
        });

        broadcast({ type: "record_updated", entityId: entity.id });

        const usedFields = Object.keys(mappedData).join(", ");
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, id, fields_used: usedFields }) }],
        };
      },
    ),

    tool(
      "update_record",
      "Update fields of an existing record. Only provided fields change; others are preserved. Keys must match the entity's field names (use list_entities to check).",
      {
        entity_name: z.string().describe("Name or ID of the entity the record belongs to"),
        record_id: z.string().describe("ID of the record to update"),
        data: z.record(z.unknown()).describe("Partial record data as key-value pairs. Only keys you provide are updated."),
      },
      async ({ entity_name, record_id, data }) => {
        const entity = await resolveEntity(ctx.db, entity_name);
        if (!entity) {
          return { content: [{ type: "text" as const, text: `Entity "${entity_name}" not found` }], isError: true };
        }

        const [record] = await ctx.db
          .select()
          .from(entityRecords)
          .where(eq(entityRecords.id, record_id))
          .limit(1);
        if (!record) {
          return { content: [{ type: "text" as const, text: `Record "${record_id}" not found` }], isError: true };
        }
        if (record.entityId !== entity.id) {
          return { content: [{ type: "text" as const, text: `Record "${record_id}" does not belong to entity "${entity.name}"` }], isError: true };
        }

        const fields = parseFields(entity.fields);
        const mappedData = mapDataKeysToFieldSlugs(data, fields);
        const existingData = JSON.parse(record.data as string) as Record<string, unknown>;
        const mergedData = { ...existingData, ...mappedData };

        await ctx.db
          .update(entityRecords)
          .set({ data: JSON.stringify(mergedData), updatedAt: new Date() })
          .where(eq(entityRecords.id, record_id));

        broadcast({ type: "record_updated", entityId: entity.id });

        const updatedFields = Object.keys(mappedData).join(", ");
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, id: record_id, fields_updated: updatedFields }) }],
        };
      },
    ),

    tool(
      "delete_record",
      "Delete a record permanently. Requires entity_name and record_id for safety.",
      {
        entity_name: z.string().describe("Name or ID of the entity the record belongs to"),
        record_id: z.string().describe("ID of the record to delete"),
      },
      async ({ entity_name, record_id }) => {
        const entity = await resolveEntity(ctx.db, entity_name);
        if (!entity) {
          return { content: [{ type: "text" as const, text: `Entity "${entity_name}" not found` }], isError: true };
        }

        const [record] = await ctx.db
          .select({ id: entityRecords.id, entityId: entityRecords.entityId })
          .from(entityRecords)
          .where(eq(entityRecords.id, record_id))
          .limit(1);
        if (!record) {
          return { content: [{ type: "text" as const, text: `Record "${record_id}" not found` }], isError: true };
        }
        if (record.entityId !== entity.id) {
          return { content: [{ type: "text" as const, text: `Record "${record_id}" does not belong to entity "${entity.name}"` }], isError: true };
        }

        await ctx.db.delete(entityRecords).where(eq(entityRecords.id, record_id));
        broadcast({ type: "record_updated", entityId: entity.id });

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, id: record_id }) }],
        };
      },
    ),
  ];
}
