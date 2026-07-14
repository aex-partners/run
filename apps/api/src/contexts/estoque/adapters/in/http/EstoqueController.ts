import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { RegistrarMovimento } from '@/contexts/estoque/application/ports/in/RegistrarMovimento'
import { ConsultarSaldo } from '@/contexts/estoque/application/ports/in/ConsultarSaldo'
import { HistoricoMovimentos } from '@/contexts/estoque/application/ports/in/HistoricoMovimentos'

// Driving adapter (tRPC). Casca fina sobre as in-ports do estoque (as MESMAS que as
// tools do Eric chamam). Sem lógica: valida a forma com zod e desembrulha o Result.
export const estoqueController = (deps: {
  registrarMovimento: RegistrarMovimento
  consultarSaldo: ConsultarSaldo
  historicoMovimentos: HistoricoMovimentos
}) =>
  router({
    // Diferente da tool do Eric, o controller aceita `entrada_nota`: o `compras` chama a
    // in-port DIRETO (via ACL), não por HTTP, e a UI de compras é quem lança a nota. A
    // guarda contra entrada sem documento vive na tool, onde o risco existe.
    registrarMovimento: protectedProcedure
      .input(
        z.object({
          insumoId: z.string().min(1),
          depositoId: z.string().min(1),
          tipo: z.string().min(1),
          qtd: z.number(),
          custoUnitario: z.number().optional(),
          data: z.string().min(1).optional(),
          origemTipo: z.string().min(1).optional(),
          origemId: z.string().min(1).optional(),
          observacao: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.registrarMovimento.execute(input))),

    saldo: protectedProcedure
      .input(z.object({ insumoId: z.string().min(1) }))
      .query(async ({ input }) => unwrap(await deps.consultarSaldo.execute(input))),

    historico: protectedProcedure
      .input(z.object({ insumoId: z.string().min(1), limite: z.number().optional() }))
      .query(async ({ input }) => unwrap(await deps.historicoMovimentos.execute(input))),
  })
