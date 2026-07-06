import {
  DescribeEntity,
  EntityDescription,
  EntityFieldView,
} from '@/contexts/data/application/ports/in/DescribeEntity'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { AexFieldCodec } from '@/contexts/data/application/mappers/AexFieldCodec'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'

// Cross-context read in-port. Projects an entity's fields into the plain shape the
// forms EntityCatalog ACL and the AI describe_entity/list_entities tools consume.
export class DescribeEntityService implements DescribeEntity {
  constructor(private readonly entities: EntityRepository) {}

  async execute(ref: string): Promise<EntityDescription | null> {
    const entity = await this.entities.findByRef(ref)
    if (!entity) return null
    return {
      id: entity.id.value,
      name: entity.name,
      slug: entity.slug,
      description: entity.description,
      createdAt: entity.createdAt,
      fields: this.fields(entity),
    }
  }

  private fields(entity: EntityDefinition): EntityFieldView[] {
    return entity.fields().map((f) => {
      const aex = AexFieldCodec.toAex(f)
      const view: EntityFieldView = {
        id: aex.id,
        name: aex.name,
        slug: aex.slug,
        type: aex.type,
        required: aex.required,
      }
      if (aex.defaultValue) view.defaultValue = aex.defaultValue
      if (aex.description) view.description = aex.description
      if (aex.options) view.options = aex.options
      if (aex.maxRating !== undefined) view.maxRating = aex.maxRating
      if (aex.currencyCode) view.currencyCode = aex.currencyCode
      if (aex.relationshipEntityId) view.relationshipEntityId = aex.relationshipEntityId
      if (aex.relationshipEntityName) view.relationshipEntityName = aex.relationshipEntityName
      if (aex.labelFieldId) view.labelFieldId = aex.labelFieldId
      if (aex.multiple) view.multiple = true
      if (aex.viaFieldId) view.viaFieldId = aex.viaFieldId
      if (aex.lookupFieldId) view.lookupFieldId = aex.lookupFieldId
      if (aex.aiPrompt) view.aiPrompt = aex.aiPrompt
      return view
    })
  }
}
