import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/manufacturing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/manufacturing/application/ports/out/RecordStore'
import { DefinirOperacao } from '@/contexts/manufacturing/application/ports/in/DefinirOperacao'
import { ManufacturingError } from '@/contexts/manufacturing/domain/ManufacturingError'

export class DefinirOperacaoService implements DefinirOperacao {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(cmd: {
    id?: string
    modeloId: string
    codigo: string
    seq: number
    nome: string
    centroId: string | null
    tempoPadraoMin: number
    tempoPorTamanho?: Record<string, number>
    tempoSetupMin?: number
    loteSetup?: number
    agregada?: boolean
  }): Promise<Result<{ id: string }>> {
    const opsId = await this.registry.entityIdBySlug('operacoes')
    if (!opsId) return fail(ManufacturingError.entidadeFaltando)

    const data = {
      modelo: cmd.modeloId,
      codigo: cmd.codigo,
      seq: cmd.seq,
      nome: cmd.nome,
      centro: cmd.centroId,
      tempo_padrao_min: cmd.tempoPadraoMin,
      tempo_por_tamanho: JSON.stringify(cmd.tempoPorTamanho ?? {}),
      tempo_setup_min: cmd.tempoSetupMin ?? 0,
      lote_setup: cmd.loteSetup ?? 1,
      agregada: cmd.agregada ?? true,
      rev: 0,
      status: 'rascunho',
    }

    if (!cmd.id) {
      const id = await this.store.insert(opsId, data)
      return ok({ id })
    }

    const existing = await this.store.get(cmd.id)
    if (!existing) return fail('operação não encontrada')

    // A revisão PUBLICADA é IMUTÁVEL. Sobrescrever a linha aqui a devolveria para
    // rascunho/rev 0, e como `selecionarRoteiroPublicado` só enxerga as linhas da MAIOR rev
    // publicada, as OUTRAS operações da revisão sumiriam do custo na hora — e o publish
    // seguinte (que promove só rascunhos) criaria uma revisão contendo APENAS esta linha,
    // apagando as demais para sempre. Editar exige abrir uma revisão nova (que clona o
    // conjunto COMPLETO para rascunho) e mexer no rascunho.
    if (existing.data.status === 'publicada') return fail(ManufacturingError.operacaoPublicada)

    // O `codigo` é a IDENTIDADE ESTÁVEL da operação no modelo — o update reescreve a linha inteira
    // a partir de `cmd`, então deixá-lo passar RE-IDENTIFICARIA a operação: toda linha de ficha
    // técnica atribuída ao código antigo (operacao_codigo) vira uma atribuição ORFÃ, e o "onde
    // cada insumo é consumido" (o headline da feature) quebra em silêncio — a atribuição pendurada
    // só aparece como erro soft na explosão seguinte. Trocar de operação é criar outra linha.
    const codigoAtual = String(existing.data.codigo ?? '')
    if (codigoAtual !== '' && codigoAtual !== cmd.codigo) {
      return fail(ManufacturingError.codigoImutavel(codigoAtual, cmd.codigo))
    }

    await this.store.update(existing.id, data, existing.version)
    return ok({ id: existing.id })
  }
}
