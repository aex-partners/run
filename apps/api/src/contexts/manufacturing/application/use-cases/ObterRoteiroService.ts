import { EntityRegistry } from '@/contexts/manufacturing/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/manufacturing/application/ports/out/RecordStore'
import { ObterRoteiro, RoteiroView } from '@/contexts/manufacturing/application/ports/in/ObterRoteiro'
import { selecionarRoteiroPublicado, OperacaoRow } from '@/contexts/manufacturing/domain/Roteiro'

// Teto do query engine do data (`Math.min(limit ?? 50, 500)`). `operacoes` guarda TODAS as
// revisões do modelo: sem limite explícito o engine devolveria só as 50 linhas mais recentes e
// as ops da revisão PUBLICADA (as mais antigas) sumiriam, gerando roteiro curto ou vazio.
const LIMITE = 500

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0
const parseMap = (v: unknown): Record<string, number> => {
  if (v == null || v === '') return {}
  try {
    const o = typeof v === 'string' ? JSON.parse(v) : v
    return o && typeof o === 'object' ? (o as Record<string, number>) : {}
  } catch {
    return {}
  }
}

export class ObterRoteiroService implements ObterRoteiro {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(q: { modeloId: string }): Promise<RoteiroView | null> {
    const opsId = await this.registry.entityIdBySlug('operacoes')
    const centrosId = await this.registry.entityIdBySlug('centros_de_trabalho')
    if (!opsId || !centrosId) return null

    const rows = await this.store.query(opsId, [{ field: 'modelo', op: 'eq', value: q.modeloId }], LIMITE)
    const ops: OperacaoRow[] = rows.map((r) => ({
      id: r.id,
      seq: num(r.data.seq),
      nome: String(r.data.nome ?? ''),
      centroId: r.data.centro == null || r.data.centro === '' ? null : String(r.data.centro),
      tempoPadraoMin: num(r.data.tempo_padrao_min),
      tempoPorTamanho: parseMap(r.data.tempo_por_tamanho),
      tempoSetupMin: num(r.data.tempo_setup_min),
      loteSetup: num(r.data.lote_setup) || 1,
      agregada: r.data.agregada === true,
      rev: num(r.data.rev),
      status: String(r.data.status ?? ''),
    }))

    const roteiro = selecionarRoteiroPublicado(q.modeloId, ops)
    if (!roteiro) return null

    const centroIds = [...new Set(roteiro.operacoes.map((o) => o.centroId).filter((c): c is string => !!c))]
    const centros = []
    for (const id of centroIds) {
      const c = await this.store.get(id) // get() by PK — NUNCA query por field 'id'
      if (c) centros.push({ id: c.id, custoMinMod: c.data.custo_min_mod == null ? null : num(c.data.custo_min_mod) })
    }

    return {
      modeloId: roteiro.modeloId,
      rev: roteiro.rev,
      operacoes: roteiro.operacoes.map((o) => ({
        id: o.id,
        seq: o.seq,
        centroId: o.centroId,
        tempoPadraoMin: o.tempoPadraoMin,
        tempoPorTamanho: o.tempoPorTamanho,
        tempoSetupMin: o.tempoSetupMin,
        loteSetup: o.loteSetup,
      })),
      centros,
    }
  }
}
