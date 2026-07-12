// PURE. O roteiro de um Modelo: seleção da revisão publicada + ordenação.
// Tempos SEMPRE em minutos (sufixo _min).
//
// INVARIANTE CENTRAL: uma revisão é um CONJUNTO COMPLETO de operações. `selecionarRoteiroPublicado`
// devolve SÓ as linhas da maior rev publicada — logo, o que não estiver naquela rev simplesmente
// NÃO EXISTE no custo. Quem garante a completude é a camada de aplicação:
//   * `DefinirOperacao` RECUSA editar uma linha já publicada (ela é imutável) e RECUSA trocar o
//     `codigo` de uma linha existente (a identidade da operação não se re-escreve).
//   * `AbrirRevisaoRoteiro` CLONA da revisão publicada, para rascunho, o que faltar (top-up
//     idempotente), então o rascunho termina completo — seja ele novo ou parcial de uma chamada
//     anterior interrompida.
//   * `PublicarRoteiro` RECUSA publicar um rascunho que não contenha todos os `codigo` da revisão
//     publicada (a menos que o chamador peça `substituirTudo` — o refino deliberado). É a rede que
//     pega TODO caminho para um rascunho incompleto, inclusive os que não passam por edição:
//     criar uma operação nova (que não toca em nada publicado) e um rascunho semeado/editado por
//     fora do fluxo (`AbrirRevisaoRoteiro` sozinho já não deixa um rascunho parcial sobreviver:
//     ele se auto-cura na próxima chamada).
// Sem essas regras, editar/adicionar UMA operação derrubaria as demais do custo, em silêncio.

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
