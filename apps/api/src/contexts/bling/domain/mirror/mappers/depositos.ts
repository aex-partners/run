import { BlingDeposito } from '@/contexts/bling/domain/mirror/BlingApiTypes'
import { MappedRecord } from '@/contexts/bling/domain/mirror/MappedRecord'
import { nStr } from '@/contexts/bling/domain/mirror/normalize'

export function mapDeposito(raw: BlingDeposito): MappedRecord {
  return {
    slug: 'bling_depositos', externalId: String(raw.id),
    data: { descricao: raw.descricao, situacao: nStr(raw.situacao), padrao: raw.padrao ?? false, desconsiderar_saldo: raw.desconsiderarSaldo ?? false },
  }
}
