import { BlingTipoContato } from '@/contexts/bling/domain/mirror/BlingApiTypes'
import { MappedRecord } from '@/contexts/bling/domain/mirror/MappedRecord'

export function mapTipoContato(raw: BlingTipoContato): MappedRecord {
  return { slug: 'bling_tipos_contato', externalId: String(raw.id), data: { descricao: raw.descricao } }
}
