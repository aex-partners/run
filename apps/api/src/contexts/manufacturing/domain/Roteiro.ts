// PURE. O roteiro de um Modelo: seleção da revisão publicada + ordenação.
// Tempos SEMPRE em minutos (sufixo _min).

export interface OperacaoRow {
  id: string
  seq: number
  nome: string
  centroId: string | null
  tempoPadraoMin: number
  tempoPorTamanho: Record<string, number>
  tempoSetupMin: number
  loteSetup: number
  agregada: boolean
  rev: number
  status: string
}

export interface RoteiroPublicado {
  modeloId: string
  rev: number
  operacoes: OperacaoRow[]
}

const publicadas = (rows: OperacaoRow[]): OperacaoRow[] => rows.filter((r) => r.status === 'publicada')

// Última revisão PUBLICADA, ordenada por seq. Rascunhos (mesmo com rev maior) são ignorados.
export function selecionarRoteiroPublicado(modeloId: string, rows: OperacaoRow[]): RoteiroPublicado | null {
  const pubs = publicadas(rows)
  if (pubs.length === 0) return null
  const rev = Math.max(...pubs.map((r) => r.rev))
  const operacoes = pubs.filter((r) => r.rev === rev).sort((a, b) => a.seq - b.seq)
  return { modeloId, rev, operacoes }
}

export function proximaRev(rows: OperacaoRow[]): number {
  const pubs = publicadas(rows)
  return Math.max(0, ...pubs.map((r) => r.rev)) + 1
}
