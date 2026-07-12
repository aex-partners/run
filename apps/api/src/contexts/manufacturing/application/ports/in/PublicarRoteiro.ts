import { Result } from '@/shared/kernel/Result'

export interface PublicarRoteiro {
  // `substituirTudo` = SUBSTITUIÇÃO DELIBERADA do roteiro inteiro (refino agregado -> detalhado:
  // a linha COSTURA agregada é INTENCIONALMENTE descartada em favor das operações finas que a
  // substituem). Sem ele, publicar um rascunho que NÃO contém todas as operações da revisão
  // publicada FALHA: uma revisão é o roteiro COMPLETO, e promover só os rascunhos apagaria as
  // operações que faltam do custo, em silêncio. O fluxo normal de alteração é
  // abrir_revisao_roteiro (clona o conjunto completo) -> editar o rascunho -> publicar.
  //
  // `operacoes` = quantas operações a nova revisão publicou. Devolvido para o chamador
  // CONFERIR o que entrou: uma revisão é o conjunto COMPLETO de operações do modelo, então
  // um número menor do que o esperado é o sinal de que o rascunho estava incompleto.
  execute(cmd: { modeloId: string; substituirTudo?: boolean }): Promise<Result<{ rev: number; operacoes: number }>>
}
