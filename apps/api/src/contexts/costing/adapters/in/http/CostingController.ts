import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { ExplodirFicha } from '@/contexts/costing/application/ports/in/ExplodirFicha'
import { RecalcularCusto } from '@/contexts/costing/application/ports/in/RecalcularCusto'
import { PublicarRevisao } from '@/contexts/costing/application/ports/in/PublicarRevisao'
import { HistoricoCusto } from '@/contexts/costing/application/ports/in/HistoricoCusto'
import { DefinirTaxaCusto } from '@/contexts/costing/application/ports/in/DefinirTaxaCusto'
import { CustoUnitario } from '@/contexts/costing/application/ports/in/CustoUnitario'
import { CustosDesatualizados } from '@/contexts/costing/application/ports/in/CustosDesatualizados'

// Driving adapter (tRPC). Thin shell over the costing in-ports (the same ones the
// AI tools call). Holds no logic: it validates the wire shape with zod and unwraps
// the in-port Result into a value or a tRPC error (historico/custoUnitario return a
// plain array / nullable view, so they are passed through as-is).
export const costingController = (deps: {
  explodirFicha: ExplodirFicha
  recalcularCusto: RecalcularCusto
  publicarRevisao: PublicarRevisao
  historicoCusto: HistoricoCusto
  definirTaxa: DefinirTaxaCusto
  custoUnitario: CustoUnitario
  custosDesatualizados: CustosDesatualizados
}) =>
  router({
    explodir: protectedProcedure
      .input(z.object({ skuId: z.string().min(1), forcar: z.boolean().optional() }))
      .mutation(async ({ input }) => unwrap(await deps.explodirFicha.execute(input))),

    recalcular: protectedProcedure
      .input(
        z.object({
          skuId: z.string().min(1).optional(),
          modeloId: z.string().min(1).optional(),
          skuIds: z.array(z.string().min(1)).optional(),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.recalcularCusto.execute(input))),

    custosDesatualizados: protectedProcedure
      .input(z.object({ modeloId: z.string().min(1).optional() }))
      .query(async ({ input }) => unwrap(await deps.custosDesatualizados.execute(input))),

    publicarRevisao: protectedProcedure
      .input(z.object({ modeloId: z.string().min(1) }))
      .mutation(async ({ input }) => unwrap(await deps.publicarRevisao.execute(input))),

    historico: protectedProcedure
      .input(z.object({ skuId: z.string().min(1) }))
      .query(async ({ input }) => deps.historicoCusto.execute(input)),

    definirTaxa: protectedProcedure
      .input(
        z.object({
          chave: z.string().min(1),
          valor: z.number(),
          centroId: z.string().min(1).nullable().optional(),
          vigenciaInicio: z.string().min(1),
          vigenciaFim: z.string().min(1).nullable().optional(),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.definirTaxa.execute(input))),

    custoUnitario: protectedProcedure
      .input(z.object({ skuId: z.string().min(1) }))
      .query(async ({ input }) => deps.custoUnitario.execute(input)),
  })
