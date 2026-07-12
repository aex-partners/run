import { Result } from '@/shared/kernel/Result'

export interface DefinirOperacao {
  execute(cmd: {
    // Sem id cria um RASCUNHO; com id atualiza — e só um RASCUNHO pode ser atualizado.
    // Editar uma operação PUBLICADA é recusado: a revisão publicada é imutável (abra uma
    // nova revisão com AbrirRevisaoRoteiro e edite o rascunho clonado).
    id?: string
    modeloId: string
    // Identidade ESTÁVEL da operação dentro do modelo (CORTE, COSTURA...). Preservada de
    // revisão em revisão; é por ela que a ficha técnica atribui o insumo à operação.
    codigo: string
    seq: number
    nome: string
    centroId: string | null
    tempoPadraoMin: number
    tempoPorTamanho?: Record<string, number>
    tempoSetupMin?: number
    loteSetup?: number
    agregada?: boolean
  }): Promise<Result<{ id: string }>>
}
