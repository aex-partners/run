import { RoteiroProvider, RoteiroPublicadoView } from '@/contexts/costing/application/ports/out/RoteiroProvider'

export class FakeRoteiroProvider implements RoteiroProvider {
  constructor(private readonly porModelo: Record<string, RoteiroPublicadoView> = {}) {}
  async roteiroPublicado(modeloId: string): Promise<RoteiroPublicadoView | null> {
    return this.porModelo[modeloId] ?? null
  }
}

// Roteiro do M1 usado nos testes: 1 operação de 10 min num centro de R$ 1,00/min.
// => MOD 10, indireto 10 × 0,5 (taxa_fixa_min do testWorld) = 5, conversão 15.
// `codigo` COSTURA: é o código que a linha de ficha f1 do testWorld atribui em `operacao_codigo`
// — é esse casamento (código da ficha × código do roteiro) que a explosão precisa acertar.
export const ROTEIRO_M1: RoteiroPublicadoView = {
  modeloId: 'M1',
  rev: 1,
  operacoes: [
    { id: 'OP1', codigo: 'COSTURA', seq: 10, centroId: 'C1', tempoPadraoMin: 10, tempoPorTamanho: {}, tempoSetupMin: 0, loteSetup: 1 },
  ],
  centros: [{ id: 'C1', custoMinMod: 1 }],
}
