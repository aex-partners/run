import { Result } from '@/shared/kernel/Result'

// Abre (ou COMPLEMENTA) a revisão em rascunho de um Modelo: clona da última revisão PUBLICADA,
// para rascunho novo (mesmo `codigo`, linha nova, rev 0), SÓ as operações cujo `codigo` ainda não
// existe no rascunho atual. É o único caminho suportado para alterar um roteiro já publicado.
//
// POR QUE CLONAR: uma revisão é o conjunto COMPLETO de operações, e `PublicarRoteiro` promove
// apenas os RASCUNHOS. Se o rascunho tivesse só a operação editada, publicar criaria uma revisão
// com UMA operação e as outras sumiriam do custo em silêncio. Clonando tudo, o rascunho já nasce
// completo e o publish não tem como perder nada.
//
// TOP-UP IDEMPOTENTE (não "fail se já há rascunho"): a versão antiga recusava rodar de novo
// quando já havia rascunho aberto. Isso travava o usuário quando `AbrirRevisaoRoteiro` morria no
// meio dos N inserts não transacionais — o rascunho ficava PARCIAL, publicar recusava (incompleto)
// e abrir de novo também recusava (já aberto): sem acesso direto ao banco não tinha saída. Agora
// chamar de novo é sempre seguro: completa o que falta e NUNCA sobrescreve/duplica um rascunho já
// existente, então uma edição em andamento sobrevive intocada.
export interface AbrirRevisaoRoteiro {
  // `operacoes` = total de rascunhos do modelo DEPOIS da chamada (o conjunto inteiro, não só o
  // que essa chamada tocou). `complementadas` = quantas operações foram clonadas NESTA chamada;
  // 0 quando o rascunho já estava completo (sucesso, não erro — chamar de novo é idempotente).
  execute(cmd: { modeloId: string }): Promise<Result<{ operacoes: number; complementadas: number }>>
}
