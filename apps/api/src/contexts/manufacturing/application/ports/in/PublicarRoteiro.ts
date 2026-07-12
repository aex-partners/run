import { Result } from '@/shared/kernel/Result'

export interface PublicarRoteiro {
  // `operacoes` = quantas operações a nova revisão publicou. Devolvido para o chamador
  // CONFERIR o que entrou: uma revisão é o conjunto COMPLETO de operações do modelo, então
  // um número menor do que o esperado é o sinal de que o rascunho estava incompleto.
  execute(cmd: { modeloId: string }): Promise<Result<{ rev: number; operacoes: number }>>
}
