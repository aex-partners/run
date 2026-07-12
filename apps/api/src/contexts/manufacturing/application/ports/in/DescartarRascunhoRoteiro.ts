import { Result } from '@/shared/kernel/Result'

// Abandona a revisão em rascunho de um Modelo: APAGA todo rascunho de operação, sem tocar na
// revisão PUBLICADA (o roteiro em vigor no custeio não muda). É a saída de emergência do
// usuário para dois casos:
//   * desistir de uma edição em andamento e recomeçar do zero;
//   * destravar um rascunho PARCIAL (crash no meio de AbrirRevisaoRoteiro) voltando ao estado
//     "sem rascunho" em vez de completá-lo com o top-up de AbrirRevisaoRoteiro.
export interface DescartarRascunhoRoteiro {
  // `descartadas` = quantos rascunhos foram apagados. 0 quando não havia nenhum — não é erro,
  // só não tinha o que descartar.
  execute(cmd: { modeloId: string }): Promise<Result<{ descartadas: number }>>
}
