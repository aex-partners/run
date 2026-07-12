// PURE. O roteiro de um Modelo: seleção da revisão publicada + ordenação.
// Tempos SEMPRE em minutos (sufixo _min).
//
// INVARIANTE CENTRAL: uma revisão é um CONJUNTO COMPLETO de operações. `selecionarRoteiroPublicado`
// devolve SÓ as linhas da maior rev publicada — logo, o que não estiver naquela rev simplesmente
// NÃO EXISTE no custo. Quem garante a completude é a camada de aplicação:
//   * `DefinirOperacao` RECUSA editar uma linha já publicada (ela é imutável).
//   * `AbrirRevisaoRoteiro` CLONA a revisão publicada inteira para rascunho, então o rascunho
//     já nasce completo e `PublicarRoteiro` (que promove só rascunhos) não pode perder operação.
// Sem essas duas regras, editar UMA operação publicada derrubaria as demais do custo, em silêncio.

export interface OperacaoRow {
  id: string
  // Identidade ESTÁVEL da operação dentro do modelo (CORTE, COSTURA...). O `id` é da LINHA e
  // muda a cada revisão; o `codigo` atravessa as revisões e é por ele que a ficha técnica
  // atribui cada insumo à operação que o consome.
  codigo: string
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
