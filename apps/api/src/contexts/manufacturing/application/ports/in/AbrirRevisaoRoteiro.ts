import { Result } from '@/shared/kernel/Result'

// Abre uma nova revisão do roteiro de um Modelo: CLONA todas as operações da última revisão
// PUBLICADA como RASCUNHOS novos (mesmo `codigo`, linhas novas, rev 0). É o único caminho
// suportado para alterar um roteiro já publicado.
//
// POR QUE CLONAR: uma revisão é o conjunto COMPLETO de operações, e `PublicarRoteiro` promove
// apenas os RASCUNHOS. Se o rascunho tivesse só a operação editada, publicar criaria uma revisão
// com UMA operação e as outras sumiriam do custo em silêncio. Clonando tudo, o rascunho já nasce
// completo e o publish não tem como perder nada.
export interface AbrirRevisaoRoteiro {
  // `operacoes` = quantas operações foram clonadas para rascunho.
  execute(cmd: { modeloId: string }): Promise<Result<{ operacoes: number }>>
}
