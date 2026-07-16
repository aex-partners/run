import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { DefinirCanal } from '@/contexts/precificacao/application/ports/in/DefinirCanal'
import { DefinirParametros } from '@/contexts/precificacao/application/ports/in/DefinirParametros'
import { DefinirCondicaoFinanceira } from '@/contexts/precificacao/application/ports/in/DefinirCondicaoFinanceira'
import { DefinirLucro } from '@/contexts/precificacao/application/ports/in/DefinirLucro'
import { GerarPrecos } from '@/contexts/precificacao/application/ports/in/GerarPrecos'
import { ConsultarPreco } from '@/contexts/precificacao/application/ports/in/ConsultarPreco'
import { PrecosDesatualizados } from '@/contexts/precificacao/application/ports/in/PrecosDesatualizados'

// Driving adapter (tRPC). Casca fina sobre as in-ports da precificação (as MESMAS que as
// tools do Eric chamam). Sem lógica: valida a forma com zod e desembrulha o Result.
export const precificacaoController = (deps: {
  definirCanal: DefinirCanal
  definirParametros: DefinirParametros
  definirCondicaoFinanceira: DefinirCondicaoFinanceira
  definirLucro: DefinirLucro
  gerarPrecos: GerarPrecos
  consultarPreco: ConsultarPreco
  precosDesatualizados: PrecosDesatualizados
}) =>
  router({
    definirCanal: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1).optional(),
          nome: z.string().min(1),
          comissao: z.number().min(0).max(1),
          frete: z.number().min(0).max(1).optional(),
          ativo: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.definirCanal.execute(input))),

    definirParametros: protectedProcedure
      .input(
        z.object({
          imposto: z.number().min(0).max(1),
          iss: z.number().min(0).max(1).optional(),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.definirParametros.execute(input))),

    definirCondicaoFinanceira: protectedProcedure
      .input(
        z.object({
          condicaoId: z.string().min(1),
          despFinanceira: z.number().min(0).max(1),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.definirCondicaoFinanceira.execute(input))),

    definirLucro: protectedProcedure
      .input(
        z.object({
          modeloId: z.string().min(1),
          canalId: z.string().min(1),
          lucroAlvo: z.number().min(0).max(1),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.definirLucro.execute(input))),

    gerarPrecos: protectedProcedure
      .input(
        z.object({
          skuId: z.string().min(1).optional(),
          modeloId: z.string().min(1).optional(),
          skuIds: z.array(z.string().min(1)).optional(),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.gerarPrecos.execute(input))),

    consultarPreco: protectedProcedure
      .input(z.object({ skuId: z.string().min(1) }))
      .query(async ({ input }) => unwrap(await deps.consultarPreco.execute(input))),

    precosDesatualizados: protectedProcedure
      .input(z.object({ modeloId: z.string().min(1).optional() }))
      .query(async ({ input }) => unwrap(await deps.precosDesatualizados.execute(input))),
  })
