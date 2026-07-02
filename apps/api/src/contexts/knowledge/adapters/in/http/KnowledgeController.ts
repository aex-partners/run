import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { CreateKnowledge } from '@/contexts/knowledge/application/ports/in/CreateKnowledge'
import { UpdateKnowledge } from '@/contexts/knowledge/application/ports/in/UpdateKnowledge'
import { DeleteKnowledge } from '@/contexts/knowledge/application/ports/in/DeleteKnowledge'
import { ListKnowledge } from '@/contexts/knowledge/application/ports/in/ListKnowledge'
import { SearchKnowledge } from '@/contexts/knowledge/application/ports/in/SearchKnowledge'
import { GetKnowledge } from '@/contexts/knowledge/application/queries/GetKnowledge'
import { ListCategories } from '@/contexts/knowledge/application/queries/ListCategories'

// Driving adapter (tRPC). Ports the AEX `knowledgeRouter` 1:1: same zod shapes,
// same procedure names, reads as `.query` / writes as `.mutation`. The acting
// user is server-authoritative, sourced from the protected-procedure context
// (`ctx.user.id`, AEX's `ctx.session.user.id`) and fed to the use-cases as
// `requestedBy` / `createdBy`. Holds no logic of its own.
export const knowledgeController = (deps: {
  create: CreateKnowledge
  update: UpdateKnowledge
  remove: DeleteKnowledge
  list: ListKnowledge
  get: GetKnowledge
  search: SearchKnowledge
  categories: ListCategories
}) =>
  router({
    list: protectedProcedure
      .input(
        z
          .object({
            scope: z.enum(['company', 'personal']).optional(),
            category: z.string().optional(),
            limit: z.number().min(1).max(200).default(50),
            offset: z.number().min(0).default(0),
          })
          .default({}),
      )
      .query(({ ctx, input }) =>
        deps.list.execute({
          requestedBy: ctx.user.id,
          scope: input.scope,
          category: input.category,
          limit: input.limit,
          offset: input.offset,
        }),
      ),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ ctx, input }) => deps.get.execute({ id: input.id, requestedBy: ctx.user.id })),

    create: protectedProcedure
      .input(
        z.object({
          scope: z.enum(['company', 'personal']),
          category: z.string().min(1),
          title: z.string().min(1),
          content: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.create.execute({ ...input, createdBy: ctx.user.id })),
      ),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          scope: z.enum(['company', 'personal']).optional(),
          category: z.string().optional(),
          title: z.string().optional(),
          content: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.update.execute({ ...input, requestedBy: ctx.user.id })),
      ),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.remove.execute({ id: input.id, requestedBy: ctx.user.id })),
      ),

    // AEX defines `search` as a mutation (it triggers embedding generation), so we
    // mirror that here even though it reads. SearchKnowledge returns plain results,
    // not a Result, so no unwrap is needed.
    search: protectedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .mutation(({ ctx, input }) =>
        deps.search.execute({ query: input.query, requestedBy: ctx.user.id }),
      ),

    categories: protectedProcedure.query(() => deps.categories.execute()),
  })
