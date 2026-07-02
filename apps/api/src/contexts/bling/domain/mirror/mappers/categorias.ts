import { BlingCategoriaProduto } from '@/contexts/bling/domain/mirror/BlingApiTypes'
import { MappedRecord, relRef } from '@/contexts/bling/domain/mirror/MappedRecord'

export function mapCategoria(raw: BlingCategoriaProduto): MappedRecord {
  return {
    slug: 'bling_categorias_produtos',
    externalId: String(raw.id),
    data: { descricao: raw.descricao, categoria_pai: relRef('bling_categorias_produtos', raw.categoriaPai?.id) },
  }
}
