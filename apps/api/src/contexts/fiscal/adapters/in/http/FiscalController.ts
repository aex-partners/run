import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { EmitNfe } from '@/contexts/fiscal/application/ports/in/EmitNfe'
import { EmitNfce } from '@/contexts/fiscal/application/ports/in/EmitNfce'
import { GetFiscalStatus } from '@/contexts/fiscal/application/ports/in/GetFiscalStatus'
import { CancelFiscalDocument } from '@/contexts/fiscal/application/ports/in/CancelFiscalDocument'
import { FiscalItem, itemTotal } from '@/contexts/fiscal/domain/FiscalItem'
import { Destinatario } from '@/contexts/fiscal/domain/Destinatario'

// Driving adapter (tRPC). Thin shell over the fiscal in-ports (the same ones the AI
// tools call). Computes each line total here; holds no other logic.
const enderecoSchema = z.object({
  logradouro: z.string().min(1),
  numero: z.string().min(1),
  bairro: z.string().min(1),
  municipio: z.string().min(1),
  codigoMunicipio: z.string().optional(),
  uf: z.string().min(1),
  cep: z.string().min(1),
  complemento: z.string().optional(),
})

const destinatarioSchema = z.object({
  nome: z.string().min(1),
  cpfCnpj: z.string().min(1),
  ie: z.string().optional(),
  email: z.string().optional(),
  endereco: enderecoSchema.optional(),
})

const itemSchema = z.object({
  descricao: z.string().min(1),
  ncm: z.string().min(1),
  cfop: z.string().min(1),
  cst: z.string().optional(),
  csosn: z.string().optional(),
  origem: z.string().optional(),
  unidade: z.string().min(1),
  quantidade: z.number().positive(),
  valorUnitario: z.number().positive(),
})

const ambienteSchema = z.enum(['homologacao', 'producao']).optional()

type ItemInput = z.infer<typeof itemSchema>
type DestInput = z.infer<typeof destinatarioSchema>

const toItems = (itens: ItemInput[]): FiscalItem[] =>
  itens.map((it) => ({
    descricao: it.descricao,
    ncm: it.ncm,
    cfop: it.cfop,
    cst: it.cst,
    csosn: it.csosn,
    origem: it.origem ?? '0',
    unidade: it.unidade,
    quantidade: it.quantidade,
    valorUnitario: it.valorUnitario,
    valorTotal: itemTotal(it.quantidade, it.valorUnitario),
  }))

const toDest = (d: DestInput): Destinatario => ({
  nome: d.nome,
  cpfCnpj: d.cpfCnpj,
  ie: d.ie,
  email: d.email,
  endereco: d.endereco,
})

export const fiscalController = (deps: {
  emitNfe: EmitNfe
  emitNfce: EmitNfce
  status: GetFiscalStatus
  cancel: CancelFiscalDocument
}) =>
  router({
    emitNfe: protectedProcedure
      .input(
        z.object({
          destinatario: destinatarioSchema,
          itens: z.array(itemSchema).min(1),
          ambiente: ambienteSchema,
        }),
      )
      .mutation(async ({ input }) =>
        unwrap(
          await deps.emitNfe.execute({
            destinatario: toDest(input.destinatario),
            items: toItems(input.itens),
            ambiente: input.ambiente,
          }),
        ),
      ),

    emitNfce: protectedProcedure
      .input(
        z.object({
          destinatario: destinatarioSchema.optional(),
          itens: z.array(itemSchema).min(1),
          ambiente: ambienteSchema,
        }),
      )
      .mutation(async ({ input }) =>
        unwrap(
          await deps.emitNfce.execute({
            destinatario: input.destinatario ? toDest(input.destinatario) : undefined,
            items: toItems(input.itens),
            ambiente: input.ambiente,
          }),
        ),
      ),

    status: protectedProcedure
      .input(z.object({ chave: z.string().length(44) }))
      .query(async ({ input }) => unwrap(await deps.status.execute({ chave: input.chave }))),

    cancel: protectedProcedure
      .input(z.object({ chave: z.string().length(44), reason: z.string().min(15) }))
      .mutation(async ({ input }) =>
        unwrap(await deps.cancel.execute({ chave: input.chave, reason: input.reason })),
      ),
  })
