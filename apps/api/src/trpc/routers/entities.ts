import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../index.js";
import { entities, entityRecords } from "../../db/schema/index.js";
import { broadcast } from "../../ws/index.js";
import {
  slugify,
  parseFields,
  serializeFields,
  validateFieldType,
  validateRecordData,
  type EntityField,
} from "../../db/entity-fields.js";

export const entitiesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.execute(sql`
      SELECT e.*, (SELECT COUNT(*) FROM entity_records WHERE entity_id = e.id) as record_count
      FROM entities e ORDER BY e.created_at DESC
    `);

    return rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      fields: parseFields(row.fields as string),
      recordCount: Number(row.record_count) || 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  }),

  createEntity: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        fields: z.array(z.object({
          name: z.string().min(1),
          type: z.enum(["text", "number", "email", "phone", "date", "select", "checkbox"]),
          required: z.boolean().default(false),
          options: z.array(z.string()).optional(),
        })).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      const slug = slugify(input.name);
      const fields: EntityField[] = input.fields.map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        slug: slugify(f.name),
        type: f.type,
        required: f.required,
        ...(f.options ? { options: f.options } : {}),
      }));

      await ctx.db.insert(entities).values({
        id,
        name: input.name,
        slug,
        fields: serializeFields(fields),
        createdBy: ctx.session.user.id,
      });

      broadcast({ type: "entity_updated" });
      return { id, name: input.name, slug };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [entity] = await ctx.db
        .select()
        .from(entities)
        .where(eq(entities.id, input.id))
        .limit(1);
      if (!entity) return null;
      return {
        ...entity,
        fields: parseFields(entity.fields),
      };
    }),

  records: protectedProcedure
    .input(
      z.object({
        entityId: z.string(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(entityRecords)
        .where(eq(entityRecords.entityId, input.entityId))
        .orderBy(desc(entityRecords.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows.map((r) => ({
        id: r.id,
        entityId: r.entityId,
        data: JSON.parse(r.data) as Record<string, unknown>,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    }),

  createRecord: protectedProcedure
    .input(
      z.object({
        entityId: z.string(),
        data: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [entity] = await ctx.db
        .select()
        .from(entities)
        .where(eq(entities.id, input.entityId))
        .limit(1);
      if (!entity) throw new Error("Entity not found");

      const fields = parseFields(entity.fields);
      // Allow empty/draft records (skip required check for inline creation)
      const isEmpty = Object.keys(input.data).length === 0 ||
        Object.values(input.data).every((v) => v === "" || v === null || v === undefined);
      const validation = validateRecordData(input.data, fields, isEmpty);
      if (!validation.valid) {
        throw new Error(validation.errors.join(" "));
      }

      const id = crypto.randomUUID();
      await ctx.db.insert(entityRecords).values({
        id,
        entityId: input.entityId,
        data: JSON.stringify(input.data),
        createdBy: ctx.session.user.id,
      });

      broadcast({ type: "record_updated", entityId: input.entityId });
      return { id };
    }),

  updateRecord: protectedProcedure
    .input(
      z.object({
        recordId: z.string(),
        data: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [record] = await ctx.db
        .select()
        .from(entityRecords)
        .where(eq(entityRecords.id, input.recordId))
        .limit(1);
      if (!record) throw new Error("Record not found");

      const [entity] = await ctx.db
        .select()
        .from(entities)
        .where(eq(entities.id, record.entityId))
        .limit(1);
      if (!entity) throw new Error("Entity not found");

      const fields = parseFields(entity.fields);
      const validation = validateRecordData(input.data, fields, true);
      if (!validation.valid) {
        throw new Error(validation.errors.join(" "));
      }

      const existingData = JSON.parse(record.data) as Record<string, unknown>;
      const mergedData = { ...existingData, ...input.data };

      await ctx.db
        .update(entityRecords)
        .set({ data: JSON.stringify(mergedData), updatedAt: new Date() })
        .where(eq(entityRecords.id, input.recordId));

      broadcast({ type: "record_updated", entityId: record.entityId });
      return { id: input.recordId };
    }),

  deleteRecord: protectedProcedure
    .input(z.object({ recordId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [record] = await ctx.db
        .select({ id: entityRecords.id, entityId: entityRecords.entityId })
        .from(entityRecords)
        .where(eq(entityRecords.id, input.recordId))
        .limit(1);
      if (!record) throw new Error("Record not found");

      await ctx.db
        .delete(entityRecords)
        .where(eq(entityRecords.id, input.recordId));

      broadcast({ type: "record_updated", entityId: record.entityId });
      return { success: true };
    }),

  deleteEntity: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(entities)
        .where(eq(entities.id, input.id));

      broadcast({ type: "entity_updated" });
      return { success: true };
    }),

  renameEntity: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(entities)
        .set({ name: input.name, slug: slugify(input.name), updatedAt: new Date() })
        .where(eq(entities.id, input.id));

      broadcast({ type: "entity_updated" });
      return { success: true };
    }),

  updateDescription: protectedProcedure
    .input(z.object({ id: z.string(), description: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(entities)
        .set({ description: input.description, updatedAt: new Date() })
        .where(eq(entities.id, input.id));

      broadcast({ type: "entity_updated" });
      return { success: true };
    }),

  addField: protectedProcedure
    .input(
      z.object({
        entityId: z.string(),
        name: z.string().min(1),
        type: z.enum(["text", "number", "email", "phone", "date", "select", "checkbox"]),
        required: z.boolean().default(false),
        options: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [entity] = await ctx.db
        .select()
        .from(entities)
        .where(eq(entities.id, input.entityId))
        .limit(1);
      if (!entity) throw new Error("Entity not found");

      const fields = parseFields(entity.fields);
      const newField: EntityField = {
        id: crypto.randomUUID(),
        name: input.name,
        slug: slugify(input.name),
        type: input.type,
        required: input.required,
        ...(input.options ? { options: input.options } : {}),
      };
      fields.push(newField);

      await ctx.db
        .update(entities)
        .set({ fields: serializeFields(fields), updatedAt: new Date() })
        .where(eq(entities.id, input.entityId));

      broadcast({ type: "entity_updated" });
      return { id: newField.id };
    }),

  updateField: protectedProcedure
    .input(
      z.object({
        entityId: z.string(),
        fieldId: z.string(),
        updates: z.object({
          name: z.string().optional(),
          type: z.enum(["text", "number", "email", "phone", "date", "select", "checkbox"]).optional(),
          required: z.boolean().optional(),
          description: z.string().optional(),
          options: z.array(z.string()).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [entity] = await ctx.db
        .select()
        .from(entities)
        .where(eq(entities.id, input.entityId))
        .limit(1);
      if (!entity) throw new Error("Entity not found");

      const fields = parseFields(entity.fields).map((f) => {
        if (f.id !== input.fieldId) return f;
        return {
          ...f,
          ...(input.updates.name !== undefined ? { name: input.updates.name, slug: slugify(input.updates.name) } : {}),
          ...(input.updates.type !== undefined ? { type: input.updates.type } : {}),
          ...(input.updates.required !== undefined ? { required: input.updates.required } : {}),
          ...(input.updates.options !== undefined ? { options: input.updates.options } : {}),
        };
      });

      await ctx.db
        .update(entities)
        .set({ fields: serializeFields(fields), updatedAt: new Date() })
        .where(eq(entities.id, input.entityId));

      broadcast({ type: "entity_updated" });
      return { success: true };
    }),

  removeField: protectedProcedure
    .input(z.object({ entityId: z.string(), fieldId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [entity] = await ctx.db
        .select()
        .from(entities)
        .where(eq(entities.id, input.entityId))
        .limit(1);
      if (!entity) throw new Error("Entity not found");

      const fields = parseFields(entity.fields).filter((f) => f.id !== input.fieldId);

      await ctx.db
        .update(entities)
        .set({ fields: serializeFields(fields), updatedAt: new Date() })
        .where(eq(entities.id, input.entityId));

      broadcast({ type: "entity_updated" });
      return { success: true };
    }),
});
