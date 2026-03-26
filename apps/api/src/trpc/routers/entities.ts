import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../index.js";
import { entities, entityRecords } from "../../db/schema/index.js";
import { broadcast } from "../../ws/index.js";
import { entityFieldTypeSchema, entityFieldOptionSchema } from "@aex/shared";
import {
  slugify,
  parseFields,
  serializeFields,
  validateFieldType,
  validateRecordData,
  type EntityField,
} from "../../db/entity-fields.js";

/** Shared Zod shape for field config properties */
const fieldConfigShape = {
  description: z.string().optional(),
  defaultValue: z.string().optional(),
  options: z.array(entityFieldOptionSchema).optional(),
  formula: z.string().optional(),
  relationshipEntityId: z.string().optional(),
  relationshipEntityName: z.string().optional(),
  lookupFieldId: z.string().optional(),
  rollupFunction: z.enum(["count", "sum", "avg", "min", "max"]).optional(),
  currencyCode: z.string().optional(),
  aiPrompt: z.string().optional(),
  maxRating: z.number().min(1).max(10).optional(),
  decimalPlaces: z.number().min(0).max(10).optional(),
};

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
          type: entityFieldTypeSchema,
          required: z.boolean().default(false),
          unique: z.boolean().default(false),
          ...fieldConfigShape,
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
        ...(f.unique ? { unique: true } : {}),
        ...(f.options ? { options: f.options } : {}),
        ...(f.description ? { description: f.description } : {}),
        ...(f.defaultValue ? { defaultValue: f.defaultValue } : {}),
        ...(f.formula ? { formula: f.formula } : {}),
        ...(f.relationshipEntityId ? { relationshipEntityId: f.relationshipEntityId } : {}),
        ...(f.relationshipEntityName ? { relationshipEntityName: f.relationshipEntityName } : {}),
        ...(f.lookupFieldId ? { lookupFieldId: f.lookupFieldId } : {}),
        ...(f.rollupFunction ? { rollupFunction: f.rollupFunction } : {}),
        ...(f.currencyCode ? { currencyCode: f.currencyCode } : {}),
        ...(f.aiPrompt ? { aiPrompt: f.aiPrompt } : {}),
        ...(f.maxRating ? { maxRating: f.maxRating } : {}),
        ...(f.decimalPlaces !== undefined ? { decimalPlaces: f.decimalPlaces } : {}),
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

      // Auto-populate system fields
      const systemValues: Record<string, unknown> = {};
      for (const field of fields) {
        if (field.type === "created_at" || field.type === "updated_at") {
          systemValues[field.slug] = new Date().toISOString();
        }
        if (field.type === "created_by" || field.type === "updated_by") {
          systemValues[field.slug] = ctx.session.user.name ?? ctx.session.user.email;
        }
      }
      const finalData = { ...input.data, ...systemValues };

      const id = crypto.randomUUID();
      await ctx.db.insert(entityRecords).values({
        id,
        entityId: input.entityId,
        data: JSON.stringify(finalData),
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

      // Auto-update system fields (separate object to avoid mutating frozen input)
      const systemUpdates: Record<string, unknown> = {};
      for (const field of fields) {
        if (field.type === "updated_at") {
          systemUpdates[field.slug] = new Date().toISOString();
        }
        if (field.type === "updated_by") {
          systemUpdates[field.slug] = ctx.session.user.name ?? ctx.session.user.email;
        }
      }

      const existingData = JSON.parse(record.data) as Record<string, unknown>;
      const mergedData = { ...existingData, ...input.data, ...systemUpdates };

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
        type: entityFieldTypeSchema,
        required: z.boolean().default(false),
        unique: z.boolean().default(false),
        ...fieldConfigShape,
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
        ...(input.unique ? { unique: true } : {}),
        ...(input.options ? { options: input.options } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.defaultValue ? { defaultValue: input.defaultValue } : {}),
        ...(input.formula ? { formula: input.formula } : {}),
        ...(input.relationshipEntityId ? { relationshipEntityId: input.relationshipEntityId } : {}),
        ...(input.relationshipEntityName ? { relationshipEntityName: input.relationshipEntityName } : {}),
        ...(input.lookupFieldId ? { lookupFieldId: input.lookupFieldId } : {}),
        ...(input.rollupFunction ? { rollupFunction: input.rollupFunction } : {}),
        ...(input.currencyCode ? { currencyCode: input.currencyCode } : {}),
        ...(input.aiPrompt ? { aiPrompt: input.aiPrompt } : {}),
        ...(input.maxRating ? { maxRating: input.maxRating } : {}),
        ...(input.decimalPlaces !== undefined ? { decimalPlaces: input.decimalPlaces } : {}),
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
          type: entityFieldTypeSchema.optional(),
          required: z.boolean().optional(),
          unique: z.boolean().optional(),
          ...fieldConfigShape,
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

      const { name, type, required, unique, ...config } = input.updates;
      const fields = parseFields(entity.fields).map((f) => {
        if (f.id !== input.fieldId) return f;
        const updated = { ...f };
        if (name !== undefined) { updated.name = name; updated.slug = slugify(name); }
        if (type !== undefined) updated.type = type;
        if (required !== undefined) updated.required = required;
        if (unique !== undefined) updated.unique = unique;
        // Apply config fields
        for (const [key, val] of Object.entries(config)) {
          if (val !== undefined) (updated as Record<string, unknown>)[key] = val;
        }
        return updated;
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

  searchRecords: protectedProcedure
    .input(z.object({
      entityId: z.string(),
      search: z.string().default(""),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const [entity] = await ctx.db
        .select()
        .from(entities)
        .where(eq(entities.id, input.entityId))
        .limit(1);
      if (!entity) return [];

      const fields = parseFields(entity.fields);
      // Find the first text-like field to use as the display label
      const labelField = fields.find(f => f.type === "text" && f.required)
        ?? fields.find(f => f.type === "text")
        ?? fields[0];

      // Fetch a larger batch for in-memory filtering, then slice to limit
      const fetchLimit = input.search ? 500 : input.limit;
      const rows = await ctx.db
        .select()
        .from(entityRecords)
        .where(eq(entityRecords.entityId, input.entityId))
        .orderBy(desc(entityRecords.createdAt))
        .limit(fetchLimit);

      const searchLower = input.search.toLowerCase();
      const results = rows
        .map(r => {
          const data = JSON.parse(r.data) as Record<string, unknown>;
          const label = labelField ? String(data[labelField.slug] ?? "") : r.id;
          return { id: r.id, label };
        })
        .filter(r => {
          if (!searchLower) return true;
          return r.label.toLowerCase().includes(searchLower);
        })
        .slice(0, input.limit);

      return results;
    }),

  generateFieldValue: protectedProcedure
    .input(z.object({
      entityId: z.string(),
      recordId: z.string(),
      fieldId: z.string(),
      prompt: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [record] = await ctx.db
        .select()
        .from(entityRecords)
        .where(eq(entityRecords.id, input.recordId))
        .limit(1);
      if (!record) throw new Error("Record not found");
      if (record.entityId !== input.entityId) throw new Error("Record does not belong to entity");

      const [entity] = await ctx.db
        .select()
        .from(entities)
        .where(eq(entities.id, input.entityId))
        .limit(1);
      if (!entity) throw new Error("Entity not found");

      const fields = parseFields(entity.fields);
      const data = JSON.parse(record.data) as Record<string, unknown>;

      // Replace {field_name} placeholders in prompt with actual values
      let resolvedPrompt = input.prompt;
      for (const field of fields) {
        const placeholder = `{${field.slug}}`;
        const value = data[field.slug];
        resolvedPrompt = resolvedPrompt.replaceAll(placeholder, String(value ?? ""));
      }

      const result = { text: "" };

      // Save the generated value to the record
      const fieldDef = fields.find(f => f.id === input.fieldId);
      if (fieldDef) {
        const updatedData = { ...data, [fieldDef.slug]: result.text };
        await ctx.db
          .update(entityRecords)
          .set({ data: JSON.stringify(updatedData), updatedAt: new Date() })
          .where(eq(entityRecords.id, input.recordId));

        broadcast({ type: "record_updated", entityId: input.entityId });
      }

      return { value: result.text };
    }),
});
