import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { CreateCharge } from '@/contexts/payments/application/ports/in/CreateCharge'
import { GetCharge } from '@/contexts/payments/application/ports/in/GetCharge'
import { CreatePaymentLink } from '@/contexts/payments/application/ports/in/CreatePaymentLink'
import { CreateBoleto } from '@/contexts/payments/application/ports/in/CreateBoleto'
import { GetBoleto } from '@/contexts/payments/application/ports/in/GetBoleto'
import { Money } from '@/contexts/payments/domain/Money'

// Driving adapter (tRPC). Thin shell over the payments in-ports (the same ones the
// AI tools call). Amounts cross the HTTP boundary in reais and are converted to
// centavos here. Holds no logic.
const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  taxId: z.string().min(1),
})

// Sicredi boleto payer (distinct from the PagSeguro `customer`: no email; carries an
// optional postal address the bank prints on the slip).
const pagadorSchema = z.object({
  nome: z.string().min(1),
  cpfCnpj: z.string().min(1),
  endereco: z
    .object({
      logradouro: z.string().min(1),
      numero: z.string().min(1),
      bairro: z.string().min(1),
      cidade: z.string().min(1),
      uf: z.string().min(1),
      cep: z.string().min(1),
    })
    .optional(),
})

export const paymentsController = (deps: {
  create: CreateCharge
  get: GetCharge
  link: CreatePaymentLink
  createBoleto: CreateBoleto
  getBoleto: GetBoleto
}) =>
  router({
    create: protectedProcedure
      .input(
        z.object({
          method: z.enum(['boleto', 'pix']),
          amount: z.number().positive(),
          customer: customerSchema,
          description: z.string().optional(),
          dueDate: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) =>
        unwrap(
          await deps.create.execute({
            method: input.method,
            amountCents: Money.reaisToCents(input.amount),
            customer: input.customer,
            description: input.description,
            dueDate: input.dueDate,
          }),
        ),
      ),

    get: protectedProcedure
      .input(z.object({ chargeId: z.string().min(1) }))
      .query(async ({ input }) => unwrap(await deps.get.execute({ chargeId: input.chargeId }))),

    link: protectedProcedure
      .input(
        z.object({
          amount: z.number().positive(),
          description: z.string().min(1),
          customer: customerSchema.optional(),
          reference: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) =>
        unwrap(
          await deps.link.execute({
            amountCents: Money.reaisToCents(input.amount),
            description: input.description,
            customer: input.customer,
            reference: input.reference,
          }),
        ),
      ),

    // -- Sicredi boletos (separate provider from the PagSeguro charges above) ----
    createBoleto: protectedProcedure
      .input(
        z.object({
          pagador: pagadorSchema,
          amount: z.number().positive(),
          vencimento: z.string().min(1),
          seuNumero: z.string().optional(),
          mensagem: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) =>
        unwrap(
          await deps.createBoleto.execute({
            pagador: input.pagador,
            valorCents: Money.reaisToCents(input.amount),
            vencimento: input.vencimento,
            seuNumero: input.seuNumero,
            mensagem: input.mensagem,
          }),
        ),
      ),

    getBoleto: protectedProcedure
      .input(z.object({ nossoNumero: z.string().min(1) }))
      .query(async ({ input }) => unwrap(await deps.getBoleto.execute({ nossoNumero: input.nossoNumero }))),
  })
