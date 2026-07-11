import { RoteiroProvider, RoteiroPublicadoView } from '@/contexts/costing/application/ports/out/RoteiroProvider'

// ACL bridge: costing RoteiroProvider -> manufacturing ObterRoteiro.
// Declara a forma da in-port ALVO localmente (mesma convenção dos `*Like` em
// DataRecordStore) para NUNCA cruzar a fronteira de contexto no nível de tipo; a
// in-port concreta injetada pela composition root satisfaz esta forma estruturalmente.
interface ObterRoteiroLike {
  execute(q: { modeloId: string }): Promise<RoteiroPublicadoView | null>
}

export class ManufacturingRoteiroProvider implements RoteiroProvider {
  constructor(private readonly deps: { obterRoteiro: ObterRoteiroLike }) {}

  async roteiroPublicado(modeloId: string): Promise<RoteiroPublicadoView | null> {
    return this.deps.obterRoteiro.execute({ modeloId })
  }
}
