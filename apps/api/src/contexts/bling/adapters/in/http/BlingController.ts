import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { ListBlingResource } from '@/contexts/bling/application/ports/in/ListBlingResource'
import { GetBlingRecord } from '@/contexts/bling/application/ports/in/GetBlingRecord'

// Driving adapter (tRPC). Thin shell over the bling in-ports (the same ones the AI
// tools call). Holds no logic. Read-only ERP access: list a resource or get one
// record by id.
const resourceSchema = z.enum(['produtos', 'pedidos', 'contatos'])

export const blingController = (deps: { list: ListBlingResource; get: GetBlingRecord }) =>
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
  })
