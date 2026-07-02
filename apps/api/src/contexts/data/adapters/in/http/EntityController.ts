import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { CreateEntity } from '@/contexts/data/application/ports/in/CreateEntity'
import { UpdateEntity } from '@/contexts/data/application/ports/in/UpdateEntity'
import { DeleteEntity } from '@/contexts/data/application/ports/in/DeleteEntity'
import { AddField } from '@/contexts/data/application/ports/in/AddField'
import { UpdateField } from '@/contexts/data/application/ports/in/UpdateField'
import { RemoveField } from '@/contexts/data/application/ports/in/RemoveField'
import { GenerateFieldValue } from '@/contexts/data/application/ports/in/GenerateFieldValue'
import { DescribeEntity } from '@/contexts/data/application/ports/in/DescribeEntity'
import { ListEntities } from '@/contexts/data/application/queries/ListEntities'
import { SearchRecords } from '@/contexts/data/application/queries/SearchRecords'
import { PivotRecords } from '@/contexts/data/application/queries/PivotRecords'
import {
  AexFieldInput,
  toFieldDefinitionInput,
  toFieldTypeConfig,
} from '@/contexts/data/adapters/in/http/aexFieldInput'

// Shared zod shape for the flat field config (mirrors AEX entities.ts's
// fieldConfigShape). `type`/`rollupFunction` stay strings here because the
// driving adapter (aexFieldInput) owns the type-config translation.
const fieldConfigShape = {
  description: z.string().optional(),
  defaultValue: z.string().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string(), color: z.string().optional() })).optional(),
  formula: z.string().optional(),
  relationshipEntityId: z.string().optional(),
  relationshipEntityName: z.string().optional(),
  viaFieldId: z.string().optional(),
  lookupFieldId: z.string().optional(),
  rollupFunction: z.string().optional(),
  currencyCode: z.string().optional(),
  aiPrompt: z.string().optional(),
  maxRating: z.number().min(1).max(10).optional(),
  decimalPlaces: z.number().min(0).max(10).optional(),
}

// A whole AEX-shaped field as it arrives over tRPC (type as a string + flat config).
const aexFieldShape = {
  id: z.string().optional(),
  name: z.string().min(1),
  type: z.string(),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  ...fieldConfigShape,
}

// Driving adapter (HTTP/tRPC). Validates/parses input, calls the in-port,
// unwraps Result into a response or an error. Holds no logic. Exposes the
// entity + field + entity-level read procedures of AEX's entities router.
export const entityController = (deps: {
  create: CreateEntity
  update: UpdateEntity
  remove: DeleteEntity
  addField: AddField
  updateField: UpdateField
  removeField: RemoveField
  generateFieldValue: GenerateFieldValue
  describe: DescribeEntity
  list: ListEntities
  search: SearchRecords
  pivot: PivotRecords
}) =>
  router({
    // entities.list
    list: protectedProcedure.query(() => deps.list.execute()),

    // entities.createEntity
    createEntity: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          fields: z.array(z.object(aexFieldShape)).default([]),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.create.execute({
            name: input.name,
            description: input.description,
            createdBy: ctx.user.id,
            fields: input.fields.map(toFieldDefinitionInput),
          }),
        ),
      ),

    // entities.getById — described through the field-spec read in-port
    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => deps.describe.execute(input.id)),

    // entities.renameEntity — delegates to the shared UpdateEntity in-port with
    // only the name; the aggregate re-derives the slug.
    renameEntity: protectedProcedure
      .input(z.object({ id: z.string(), name: z.string().min(1) }))
      .mutation(async ({ input }) => {
        unwrap(await deps.update.execute({ entityId: input.id, name: input.name }))
        return { success: true }
      }),

    // entities.updateDescription — same UpdateEntity in-port, description only.
    updateDescription: protectedProcedure
      .input(z.object({ id: z.string(), description: z.string() }))
      .mutation(async ({ input }) => {
        unwrap(await deps.update.execute({ entityId: input.id, description: input.description }))
        return { success: true }
      }),

    // entities.deleteEntity
    deleteEntity: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        unwrap(await deps.remove.execute({ entityId: input.id }))
        return { success: true }
      }),

    // entities.addField
    addField: protectedProcedure
      .input(z.object({ entityId: z.string(), ...aexFieldShape }))
      .mutation(async ({ input }) => {
        const { entityId, ...raw } = input
        const f = toFieldDefinitionInput(raw)
        return unwrap(
          await deps.addField.execute({
            entityId,
            name: f.name,
            required: f.required,
            type: f.type,
            id: f.id,
            displayName: f.displayName,
            unique: f.unique,
            description: f.description,
            defaultValue: f.defaultValue,
          }),
        )
      }),

    // entities.updateField
    updateField: protectedProcedure
      .input(
        z.object({
          entityId: z.string(),
          fieldId: z.string(),
          updates: z.object({
            name: z.string().optional(),
            type: z.string().optional(),
            required: z.boolean().optional(),
            unique: z.boolean().optional(),
            ...fieldConfigShape,
          }),
        }),
      )
      .mutation(async ({ input }) => {
        const { name, type, required, unique, description, defaultValue, ...config } = input.updates
        const typeConfig =
          type !== undefined
            ? toFieldTypeConfig({ name: name ?? 'field', type, ...config } as AexFieldInput)
            : undefined
        unwrap(
          await deps.updateField.execute({
            entityId: input.entityId,
            fieldId: input.fieldId,
            updates: { name, type: typeConfig, required, unique, description, defaultValue },
          }),
        )
        return { success: true }
      }),

    // entities.removeField
    removeField: protectedProcedure
      .input(z.object({ entityId: z.string(), fieldId: z.string() }))
      .mutation(async ({ input }) => {
        unwrap(await deps.removeField.execute(input))
        return { success: true }
      }),

    // entities.searchRecords
    searchRecords: protectedProcedure
      .input(
        z.object({
          entityId: z.string(),
          search: z.string().default(''),
          limit: z.number().min(1).max(50).default(20),
        }),
      )
      .query(({ input }) => deps.search.execute(input)),

    // entities.pivotData
    pivotData: protectedProcedure
      .input(z.object({ entityId: z.string(), fields: z.array(z.string().min(1)).min(1).max(20) }))
      .query(({ input }) => deps.pivot.execute(input)),

    // entities.generateFieldValue
    generateFieldValue: protectedProcedure
      .input(
        z.object({
          entityId: z.string(),
          recordId: z.string(),
          fieldId: z.string(),
          prompt: z.string(),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.generateFieldValue.execute(input))),
  })
