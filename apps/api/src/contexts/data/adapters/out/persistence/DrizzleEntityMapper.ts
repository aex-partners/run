import { entities } from '@/platform/db/schema'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { AexFieldCodec } from '@/contexts/data/application/mappers/AexFieldCodec'

export type EntityDrizzleRow = typeof entities.$inferSelect

// Translates between the domain aggregate and AEX's EXACT `entities` row shape:
// `fields` is the AEX JSON text column (id/name/slug/type/required/options/...),
// read and written through AexFieldCodec so the on-disk shape is preserved 1:1.
export const DrizzleEntityMapper = {
  toDomain(row: EntityDrizzleRow): EntityDefinition {
    const result = EntityDefinition.rehydrate(
      EntityId.of(row.id),
      row.name,
      AexFieldCodec.parse(row.fields),
      {
        slug: row.slug,
        description: row.description,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      },
    )
    if (!result.ok) throw new Error(`DrizzleEntityMapper.toDomain: ${result.error}`)
    return result.value
  },

  toInsert(entity: EntityDefinition): typeof entities.$inferInsert {
    return {
      id: entity.id.value,
      name: entity.name,
      slug: entity.slug,
      description: entity.description,
      fields: AexFieldCodec.serialize(entity.fields()),
      // FK to users; injected via CreateEntityCommand.createdBy by the driving
      // adapter. Falls back to empty string only on the never-hit demo path.
      createdBy: entity.createdBy ?? '',
    }
  },
}
