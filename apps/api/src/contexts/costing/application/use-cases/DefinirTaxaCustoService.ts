import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/costing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/costing/application/ports/out/RecordStore'
import { DefinirTaxaCusto } from '@/contexts/costing/application/ports/in/DefinirTaxaCusto'
import { CostingError } from '@/contexts/costing/domain/CostingError'

const CHAVES = ['taxa_fixa_min', 'taxa_moi_min', 'taxa_depreciacao_min']

// As datas de vigência são comparadas como STRING (lexicograficamente) em `taxasVigentes`, o que
// só é correto no formato ISO YYYY-MM-DD. Um '01/07/2026' passa batido pela comparação e produz
// uma janela que NUNCA expira ('2026-07-12' <= '31/12/2025' é TRUE, porque '2' < '3'): a taxa
// morta continua valendo para sempre e o DINHEIRO muda em silêncio. Validar aqui, na in-port,
// cobre de uma vez a tool do MCP e a rota tRPC.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export class DefinirTaxaCustoService implements DefinirTaxaCusto {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}
  async execute(cmd: {
    chave: string
    valor: number
    centroId?: string | null
    vigenciaInicio: string
    vigenciaFim?: string | null
  }): Promise<Result<{ id: string }>> {
    if (!CHAVES.includes(cmd.chave)) return fail(`chave inválida: ${cmd.chave} (use ${CHAVES.join(' | ')})`)
    if (!ISO_DATE.test(cmd.vigenciaInicio)) {
      return fail(`vigenciaInicio inválida: ${cmd.vigenciaInicio} (use o formato ISO YYYY-MM-DD)`)
    }
    if (cmd.vigenciaFim != null && cmd.vigenciaFim !== '' && !ISO_DATE.test(cmd.vigenciaFim)) {
      return fail(`vigenciaFim inválida: ${cmd.vigenciaFim} (use o formato ISO YYYY-MM-DD, ou omita para vigência aberta)`)
    }
    // Janela INVERTIDA (fim antes do início): passa o regex e falha FECHADA — `taxasVigentes` exige
    // `inicio <= hoje <= fim`, que nenhuma data satisfaz, então a taxa NUNCA entra em vigor. É
    // sempre um erro de digitação, e o sintoma (custo indireto zerado, sem erro) é indistinguível
    // de "esqueci de cadastrar a taxa". Recusar aqui é a única chance de dizer isso na cara.
    if (cmd.vigenciaFim != null && cmd.vigenciaFim !== '' && cmd.vigenciaFim < cmd.vigenciaInicio) {
      return fail(
        `vigência invertida: vigenciaFim ${cmd.vigenciaFim} é anterior a vigenciaInicio ${cmd.vigenciaInicio} ` +
        '(a taxa nunca entraria em vigor)',
      )
    }
    const id = await this.registry.entityIdBySlug('parametros_de_custo')
    if (!id) return fail(CostingError.entidadeFaltando)
    const novoId = await this.store.insert(id, {
      chave: cmd.chave, valor: cmd.valor, escopo_centro: cmd.centroId ?? null,
      vigencia_inicio: cmd.vigenciaInicio, vigencia_fim: cmd.vigenciaFim ?? null,
    })
    return ok({ id: novoId })
  }
}
