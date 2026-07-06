import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { ListBlingResource } from '@/contexts/bling/application/ports/in/ListBlingResource'
import { GetBlingRecord } from '@/contexts/bling/application/ports/in/GetBlingRecord'
import { EnqueueBlingSync } from '@/contexts/bling/application/ports/in/EnqueueBlingSync'

// Driving adapter (tRPC). Thin shell over the bling in-ports (the same ones the AI
// tools call). Holds no logic. Read-only ERP access: list a resource or get one
// record by id. `enqueueSync` is optional so this controller keeps compiling for
// callers that haven't wired the sync queue yet; when provided, it mounts a `sync`
// sub-router. `sync.run` ENQUEUES a background job (a full-mirror sync of a large
// Bling account takes ~1h, which blows the HTTP/proxy timeout and dies on every
// deploy) and returns immediately — the BlingSyncWorker runs it off the queue.
const resourceSchema = z.enum(['produtos', 'pedidos', 'contatos'])

export const blingController = (deps: {
  list: ListBlingResource
  get: GetBlingRecord
  enqueueSync?: EnqueueBlingSync
}) =>
  router({
    list: protectedProcedure
      .input(
        z.object({
          resource: resourceSchema,
          pagina: z.number().int().positive().optional(),
          limite: z.number().int().positive().optional(),
          pesquisa: z.string().optional(),
        }),
      )
      .query(async ({ input }) =>
        unwrap(
          await deps.list.execute({
            resource: input.resource,
            pagina: input.pagina,
            limite: input.limite,
            pesquisa: input.pesquisa,
          }),
        ),
      ),

    get: protectedProcedure
      .input(z.object({ resource: resourceSchema, id: z.string().min(1) }))
      .query(async ({ input }) =>
        unwrap(await deps.get.execute({ resource: input.resource, id: input.id })),
      ),

    ...(deps.enqueueSync
      ? {
          sync: router({
            // Fire-and-forget: enqueue a background full-mirror sync and return at
            // once. Idempotent enqueue (fixed jobId) — repeat clicks don't stack.
            run: protectedProcedure
              .input(
                z.object({
                  scope: z.enum(['all', 'categorias']).optional(),
                }),
              )
              .mutation(async ({ input }) => {
                await deps.enqueueSync!.enqueue(input.scope)
                return { enqueued: true as const }
              }),
            status: protectedProcedure.query(async () => ({ ok: true })),
          }),
        }
      : {}),
  })
