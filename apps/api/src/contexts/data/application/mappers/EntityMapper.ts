import { EntityDefinition, FieldDescriptor } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'

// Persistence row for the in-memory store: the dynamic schema with its AEX-shape
// metadata. The Drizzle adapter has its own mapper that serializes to AEX's exact
// `entities.fields` JSON via AexFieldCodec; this one keeps the FieldDescriptors
// structured so the in-memory double round-trips losslessly.
export interface EntityRow {
  id: string
  name: string
  slug: string
  description: string | null
  createdBy: string | null
  createdAt: Date
  fields: FieldDescriptor[]
}

export const EntityMapper = {
  toPersistence(entity: EntityDefinition): EntityRow {
    return {
      id: entity.id.value,
      name: entity.name,
      slug: entity.slug,
      description: entity.description,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      fields: entity.fields().map((f): FieldDescriptor => ({
        name: f.name.value,
        required: f.required,
        type: f.type.toConfig(),
        id: f.meta.id,
        displayName: f.meta.displayName,
        description: f.meta.description,
        unique: f.meta.unique,
        defaultValue: f.meta.defaultValue,
      })),
    }
  },

  toDomain(row: EntityRow): EntityDefinition {
    const result = EntityDefinition.rehydrate(EntityId.of(row.id), row.name, row.fields, {
      slug: row.slug,
      description: row.description,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    })
    if (!result.ok) throw new Error(`EntityMapper.toDomain: ${result.error}`)
    return result.value
  },
}
