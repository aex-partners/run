import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { CriarPedidoCompra } from '@/contexts/compras/application/ports/in/CriarPedidoCompra'
import { LancarNotaEntrada } from '@/contexts/compras/application/ports/in/LancarNotaEntrada'
import { ConsultarPedidoCompra } from '@/contexts/compras/application/ports/in/ConsultarPedidoCompra'

const itemPedido = z.object({
  insumoId: z.string().min(1),
  qtd: z.number(),
  precoUnitario: z.number(),
})

const itemNota = itemPedido.extend({
  desconto: z.number().optional(),
  imposto: z.number().optional(),
})

// Driving adapter (tRPC). Casca fina sobre as in-ports do compras (as MESMAS que as
// tools do Eric chamam). Sem lógica: valida a forma com zod e desembrulha o Result.
export const comprasController = (deps: {
  criarPedidoCompra: CriarPedidoCompra
  lancarNotaEntrada: LancarNotaEntrada
  consultarPedidoCompra: ConsultarPedidoCompra
}) =>
  router({
    criarPedido: protectedProcedure
      .input(
        z.object({
          numero: z.string().min(1),
          fornecedorId: z.string().min(1),
          data: z.string().min(1),
          previsaoEntrega: z.string().min(1).optional(),
          observacao: z.string().optional(),
          itens: z.array(itemPedido).min(1),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.criarPedidoCompra.execute(input))),

    // A NOTA É QUEM RECEBE: move o estoque e define o custo médio. `pedidoId` nulo =
    // compra direta.
    lancarNota: protectedProcedure
      .input(
        z.object({
          numero: z.string().min(1),
          serie: z.string().optional(),
          fornecedorId: z.string().min(1),
          pedidoId: z.string().min(1).nullable().optional(),
          dataEmissao: z.string().min(1),
          dataEntrada: z.string().min(1),
          depositoId: z.string().min(1),
          valorFrete: z.number().optional(),
          condicaoPagamento: z.string().optional(),
          chaveNfe: z.string().optional(),
          itens: z.array(itemNota).min(1),
        }),
      )
      .mutation(async ({ input }) => unwrap(await deps.lancarNotaEntrada.execute(input))),

    pedido: protectedProcedure
      .input(z.object({ pedidoId: z.string().min(1) }))
      .query(async ({ input }) => unwrap(await deps.consultarPedidoCompra.execute(input))),
  })
