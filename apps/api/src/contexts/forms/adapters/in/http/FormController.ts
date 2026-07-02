import { z } from 'zod'
import { router, protectedProcedure, publicProcedure, unwrap } from '@/platform/http/trpc'
import { Json, JsonObject } from '@/shared/domain/Json'
import { CreateForm } from '@/contexts/forms/application/ports/in/CreateForm'
import { UpdateForm } from '@/contexts/forms/application/ports/in/UpdateForm'
import { DeleteForm } from '@/contexts/forms/application/ports/in/DeleteForm'
import { PublishForm } from '@/contexts/forms/application/ports/in/PublishForm'
import { SubmitForm } from '@/contexts/forms/application/ports/in/SubmitForm'
import { ListForms } from '@/contexts/forms/application/queries/ListForms'
import { GetForm } from '@/contexts/forms/application/queries/GetForm'
import { GetPublicForm } from '@/contexts/forms/application/queries/GetPublicForm'
import { ListSubmissions } from '@/contexts/forms/application/queries/ListSubmissions'

// Arbitrary JSON validator whose inferred type matches the JsonObject boundary
// the SubmitForm in-port accepts (mirrors the source router's `z.record`).
const jsonValue: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
)
const jsonObject: z.ZodType<JsonObject> = z.record(jsonValue)

// Driving adapter (tRPC). Native typed router mirroring the source forms router.
// The protected ops (listByEntity / getById / listSubmissions are `.query`,
// create / update / delete / togglePublic are `.mutation`) require auth; the two
// PUBLIC ops (getPublicForm / submitPublicForm) are unauthenticated and resolve a
// form by its share token. `createdBy` is injected from `ctx.user.id`. Holds no
// logic.
export const formController = (deps: {
  create: CreateForm
  update: UpdateForm
  remove: DeleteForm
  publish: PublishForm
  list: ListForms
  get: GetForm
  submissions: ListSubmissions
  getPublic: GetPublicForm
  submit: SubmitForm
}) =>
  router({
    listByEntity: protectedProcedure
      .input(z.object({ entityId: z.string() }))
      .query(({ input }) => deps.list.execute({ entityId: input.entityId })),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => deps.get.execute({ id: input.id })),

    create: protectedProcedure
      .input(z.object({ entityId: z.string(), name: z.string().min(1) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.create.execute({
            entityId: input.entityId,
            name: input.name,
            createdBy: ctx.user.id,
          }),
        ),
      ),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          fields: z
            .array(
              z.object({
                id: z.string(),
                entityFieldId: z.string(),
                order: z.number(),
                required: z.boolean(),
                placeholder: z.string().optional(),
                helpText: z.string().optional(),
                visible: z.boolean(),
              }),
            )
            .optional(),
          settings: z
            .object({
              submitButtonText: z.string(),
              successMessage: z.string(),
              title: z.string().optional(),
              description: z.string().optional(),
            })
            .optional(),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.update.execute(input))),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.remove.execute({ id: input.id }))),

    togglePublic: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.publish.execute({ id: input.id }))),

    listSubmissions: protectedProcedure
      .input(z.object({ formId: z.string() }))
      .query(({ input }) => deps.submissions.execute({ formId: input.formId })),

    // --- PUBLIC (unauthenticated) ops: resolve a form by its share token ---
    getPublicForm: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(({ input }) => deps.getPublic.execute({ token: input.token })),

    submitPublicForm: publicProcedure
      .input(
        z.object({
          token: z.string(),
          data: jsonObject,
          submitterIp: z.string().nullish(),
        }),
      )
      .mutation(async ({ input }) =>
        unwrap(
          await deps.submit.execute({
            token: input.token,
            data: input.data,
            submitterIp: input.submitterIp,
          }),
        ),
      ),
  })
