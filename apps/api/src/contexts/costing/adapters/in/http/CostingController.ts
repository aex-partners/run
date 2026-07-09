import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { ExplodirFicha } from '@/contexts/costing/application/ports/in/ExplodirFicha'
import { RecalcularCusto } from '@/contexts/costing/application/ports/in/RecalcularCusto'
import { PublicarRevisao } from '@/contexts/costing/application/ports/in/PublicarRevisao'
import { HistoricoCusto } from '@/contexts/costing/application/ports/in/HistoricoCusto'

// Driving adapter (tRPC). Thin shell over the costing in-ports (the same ones the
// AI tools call). Holds no logic: it validates the wire shape with zod and unwraps
// the in-port Result into a value or a tRPC error (historico returns a plain array,
// so it is passed through as-is).
export const costingController = (deps: {
  explodirFicha: ExplodirFicha
  recalcularCusto: RecalcularCusto
  publicarRevisao: PublicarRevisao
  historicoCusto: HistoricoCusto
}) =>
  router({
    explodir: protectedProcedure
      .input(z.object({ skuId: z.string().min(1), forcar: z.boolean().optional() }))
      .mutation(async ({ input }) => unwrap(await deps.explodirFicha.execute(input))),

    recalcular: protectedProcedure
      .input(z.object({ skuId: z.string().min(1).optional(), modeloId: z.string().min(1).optional() }))
      .mutation(async ({ input }) => unwrap(await deps.recalcularCusto.execute(input))),

    publicarRevisao: protectedProcedure
      .input(z.object({ modeloId: z.string().min(1) }))
      .mutation(async ({ input }) => unwrap(await deps.publicarRevisao.execute(input))),

    historico: protectedProcedure
      .input(z.object({ skuId: z.string().min(1) }))
      .query(async ({ input }) => deps.historicoCusto.execute(input)),
  })
