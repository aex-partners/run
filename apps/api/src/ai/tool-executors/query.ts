/**
 * Query tool executor: wraps entity record queries.
 */
import { eq, ilike } from "drizzle-orm";
import { entities, entityRecords } from "../../db/schema/index.js";
import { slugify, parseFields } from "../../db/entity-fields.js";
import type { ToolContext } from "../tools.js";

async function resolveEntity(db: ToolContext["db"], identifier: string) {
  let [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, identifier))
    .limit(1);
  if (entity) return entity;

  [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.slug, slugify(identifier)))
    .limit(1);
  if (entity) return entity;

  [entity] = await db
    .select()
    .from(entities)
    .where(ilike(entities.name, identifier))
    .limit(1);
  return entity ?? null;
}

export async function executeQuery(
  args: Record<string, unknown>,
  config: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const entityIdOrName = (config.entityIdOrName as string) || (args.entity_id_or_name as string);
  if (!entityIdOrName) return { error: "Query tool missing entityIdOrName" };

  const entity = await resolveEntity(ctx.db, entityIdOrName);
  if (!entity) return { error: `Entity "${entityIdOrName}" not found` };

  const fields = parseFields(entity.fields);
  const limit = (config.limit as number) || (args.limit as number) || 50;

  const records = await ctx.db
    .select()
    .from(entityRecords)
    .where(eq(entityRecords.entityId, entity.id))
    .limit(limit);

  const rows = records.map((r) => {
    const data = JSON.parse(r.data) as Record<string, unknown>;
    return { id: r.id, ...data };
  });

  return {
    entity: entity.name,
    fields: fields.map((f) => f.name),
    count: rows.length,
    records: rows,
  };
}
