import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { ObterRoteiro } from '@/contexts/manufacturing/application/ports/in/ObterRoteiro'
import { DefinirCentro } from '@/contexts/manufacturing/application/ports/in/DefinirCentro'
import { ListarCentros } from '@/contexts/manufacturing/application/ports/in/ListarCentros'
import { DefinirOperacao } from '@/contexts/manufacturing/application/ports/in/DefinirOperacao'
import { PublicarRoteiro } from '@/contexts/manufacturing/application/ports/in/PublicarRoteiro'

// Driving adapter (tRPC). Thin shell over the manufacturing in-ports (the same ones
// the AI tools call). Holds no logic: it validates the wire shape with zod and unwraps
// the in-port Result into a value or a tRPC error. The queries (`roteiro`, `centros`)
// return plain views (nullable / array), so they are passed through as-is.
export const manufacturingController = (deps: {
  obterRoteiro: ObterRoteiro
  definirCentro: DefinirCentro
  listarCentros: ListarCentros
  definirOperacao: DefinirOperacao
  publicarRoteiro: PublicarRoteiro
}) =>
  router({
    definirCentro: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1).optional(),
          nome: z.string().min(1),
          setor: z.string().min(1),
          custoMinMod: z.number(),
          capacidadeMinDia: z.number().optional(),
          numOperadores: z.number().optional(),
          ativo: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.definirCentro.execute(input))),

    centros: protectedProcedure.query(async () => deps.listarCentros.execute()),

    definirOperacao: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1).optional(),
          modeloId: z.string().min(1),
          seq: z.number(),
          nome: z.string().min(1),
          centroId: z.string().min(1).nullable(),
          tempoPadraoMin: z.number(),
          tempoPorTamanho: z.record(z.string(), z.number()).optional(),
          tempoSetupMin: z.number().optional(),
          loteSetup: z.number().optional(),
          agregada: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.definirOperacao.execute(input))),

    publicarRoteiro: protectedProcedure
      .input(z.object({ modeloId: z.string().min(1) }))
      .mutation(async ({ input }) => unwrap(await deps.publicarRoteiro.execute(input))),

    roteiro: protectedProcedure
      .input(z.object({ modeloId: z.string().min(1) }))
      .query(async ({ input }) => deps.obterRoteiro.execute(input)),
  })
