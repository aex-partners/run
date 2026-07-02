import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { ListBlingResource } from '@/contexts/bling/application/ports/in/ListBlingResource'
import { GetBlingRecord } from '@/contexts/bling/application/ports/in/GetBlingRecord'
import { SyncBlingMirror } from '@/contexts/bling/application/ports/in/SyncBlingMirror'

// Driving adapter (tRPC). Thin shell over the bling in-ports (the same ones the AI
// tools call). Holds no logic. Read-only ERP access: list a resource or get one
// record by id. `sync` is optional so this controller keeps compiling for callers
// that haven't wired the SyncBlingMirror use case yet; when provided, it mounts a
// `sync` sub-router over the full-mirror sync in-port.
const resourceSchema = z.enum(['produtos', 'pedidos', 'contatos'])

export const blingController = (deps: {
  list: ListBlingResource
  get: GetBlingRecord
  sync?: SyncBlingMirror
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

    ...(deps.sync
      ? {
          sync: router({
            run: protectedProcedure
              .input(
                z.object({
                  scope: z.enum(['all', 'categorias']).optional(),
                  limit: z.number().int().positive().optional(),
                }),
              )
              .mutation(async ({ input }) =>
                unwrap(
                  await deps.sync!.execute({ scope: input.scope ?? 'all', limit: input.limit }),
                ),
              ),
            status: protectedProcedure.query(async () => ({ ok: true })),
          }),
        }
      : {}),
  })
