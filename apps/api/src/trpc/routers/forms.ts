import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, protectedProcedure, publicProcedure } from "../index.js";
import { forms, formSubmissions, entities, entityRecords } from "../../db/schema/index.js";
import { broadcast } from "../../ws/index.js";
import { parseFields, validateRecordData, type EntityField } from "../../db/entity-fields.js";
import {
  parseFormFields,
  serializeFormFields,
  parseFormSettings,
  serializeFormSettings,
  type FormField,
  type FormSettings,
} from "../../db/form-types.js";

export const formsRouter = router({
  listByEntity: protectedProcedure
    .input(z.object({ entityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(forms)
        .where(eq(forms.entityId, input.entityId))
        .orderBy(desc(forms.createdAt));

      return rows.map((row) => ({
        id: row.id,
        entityId: row.entityId,
        name: row.name,
        description: row.description,
        fields: parseFormFields(row.fields),
        settings: parseFormSettings(row.settings),
        publicToken: row.publicToken,
        isPublic: row.isPublic === 1,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [form] = await ctx.db
        .select()
        .from(forms)
        .where(eq(forms.id, input.id))
        .limit(1);
      if (!form) return null;

      return {
        ...form,
        fields: parseFormFields(form.fields),
        settings: parseFormSettings(form.settings),
        isPublic: form.isPublic === 1,
      };
    }),

  create: protectedProcedure
    .input(z.object({ entityId: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [entity] = await ctx.db
        .select()
        .from(entities)
        .where(eq(entities.id, input.entityId))
        .limit(1);
      if (!entity) throw new Error("Entity not found");

      const entityFields = parseFields(entity.fields);
      const formFields: FormField[] = entityFields.map((f, i) => ({
        id: crypto.randomUUID(),
        entityFieldId: f.id,
        order: i,
        required: f.required,
        visible: true,
      }));

      const defaultSettings: FormSettings = {
        submitButtonText: "Submit",
        successMessage: "Thank you for your submission.",
      };

      const id = crypto.randomUUID();
      await ctx.db.insert(forms).values({
        id,
        entityId: input.entityId,
        name: input.name,
        fields: serializeFormFields(formFields),
        settings: serializeFormSettings(defaultSettings),
        createdBy: ctx.session.user.id,
      });

      broadcast({ type: "form_updated", entityId: input.entityId });
      return { id, name: input.name };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      fields: z.array(z.object({
        id: z.string(),
        entityFieldId: z.string(),
        order: z.number(),
        required: z.boolean(),
        placeholder: z.string().optional(),
        helpText: z.string().optional(),
        visible: z.boolean(),
      })).optional(),
      settings: z.object({
        submitButtonText: z.string(),
        successMessage: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.fields !== undefined) updates.fields = serializeFormFields(input.fields);
      if (input.settings !== undefined) updates.settings = serializeFormSettings(input.settings);

      await ctx.db
        .update(forms)
        .set(updates)
        .where(eq(forms.id, input.id));

      broadcast({ type: "form_updated" });
      return { id: input.id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(forms).where(eq(forms.id, input.id));
      broadcast({ type: "form_updated" });
      return { success: true };
    }),

  togglePublic: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [form] = await ctx.db
        .select()
        .from(forms)
        .where(eq(forms.id, input.id))
        .limit(1);
      if (!form) throw new Error("Form not found");

      const newIsPublic = form.isPublic === 1 ? 0 : 1;
      const token = newIsPublic === 1 && !form.publicToken
        ? crypto.randomUUID()
        : form.publicToken;

      await ctx.db
        .update(forms)
        .set({ isPublic: newIsPublic, publicToken: token, updatedAt: new Date() })
        .where(eq(forms.id, input.id));

      return { isPublic: newIsPublic === 1, publicToken: token };
    }),

  getPublicForm: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const [form] = await ctx.db
        .select()
        .from(forms)
        .where(eq(forms.publicToken, input.token))
        .limit(1);
      if (!form || form.isPublic !== 1) return null;

      const [entity] = await ctx.db
        .select()
        .from(entities)
        .where(eq(entities.id, form.entityId))
        .limit(1);
      if (!entity) return null;

      const entityFields = parseFields(entity.fields);
      const formFields = parseFormFields(form.fields);
      const formSettings = parseFormSettings(form.settings);

      return {
        id: form.id,
        name: form.name,
        description: form.description,
        fields: formFields,
        settings: formSettings,
        entityFields: entityFields.map((f) => ({
          id: f.id,
          name: f.name,
          slug: f.slug,
          type: f.type,
          required: f.required,
          options: f.options,
        })),
      };
    }),

  submitPublicForm: publicProcedure
    .input(z.object({
      token: z.string(),
      data: z.record(z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      const [form] = await ctx.db
        .select()
        .from(forms)
        .where(eq(forms.publicToken, input.token))
        .limit(1);
      if (!form || form.isPublic !== 1) throw new Error("Form not found or not public");

      const [entity] = await ctx.db
        .select()
        .from(entities)
        .where(eq(entities.id, form.entityId))
        .limit(1);
      if (!entity) throw new Error("Entity not found");

      const entityFields = parseFields(entity.fields);
      const formFields = parseFormFields(form.fields);

      // Build validation fields based on form config (only visible fields, use form's required)
      const visibleFormFields = formFields.filter((ff) => ff.visible);
      const validationFields: EntityField[] = visibleFormFields.map((ff) => {
        const ef = entityFields.find((e) => e.id === ff.entityFieldId);
        if (!ef) throw new Error(`Field ${ff.entityFieldId} not found in entity`);
        return { ...ef, required: ff.required };
      });

      const validation = validateRecordData(input.data, validationFields, false);
      if (!validation.valid) {
        throw new Error(validation.errors.join(" "));
      }

      const recordId = crypto.randomUUID();
      await ctx.db.insert(entityRecords).values({
        id: recordId,
        entityId: form.entityId,
        data: JSON.stringify(input.data),
        createdBy: form.createdBy,
      });

      const submissionId = crypto.randomUUID();
      await ctx.db.insert(formSubmissions).values({
        id: submissionId,
        formId: form.id,
        entityRecordId: recordId,
        data: JSON.stringify(input.data),
      });

      broadcast({ type: "form_submitted", entityId: form.entityId });
      broadcast({ type: "record_updated", entityId: form.entityId });
      return { id: submissionId };
    }),

  listSubmissions: protectedProcedure
    .input(z.object({ formId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(formSubmissions)
        .where(eq(formSubmissions.formId, input.formId))
        .orderBy(desc(formSubmissions.createdAt));

      return rows.map((r) => ({
        id: r.id,
        formId: r.formId,
        entityRecordId: r.entityRecordId,
        data: JSON.parse(r.data) as Record<string, unknown>,
        submitterIp: r.submitterIp,
        createdAt: r.createdAt,
      }));
    }),
});
