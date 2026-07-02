import { Result, ok, fail } from '@/shared/kernel/Result'
import { BlingEntityDef, BlingFieldDef } from '@/contexts/bling/domain/mirror/BlingEntitySchema'
import { EntityCatalog } from '@/contexts/bling/application/ports/out/EntityCatalog'
import { CreateEntity } from '@/contexts/data/application/ports/in/CreateEntity'
import { AddField } from '@/contexts/data/application/ports/in/AddField'
import { DescribeEntity } from '@/contexts/data/application/ports/in/DescribeEntity'
import { ListEntities } from '@/contexts/data/application/queries/ListEntities'
import { FieldDefinitionInput } from '@/contexts/data/application/ports/in/FieldDefinitionInput'

export interface DataEntityCatalogDeps {
  createEntity: CreateEntity
  addField: AddField
  describeEntity: DescribeEntity
  listEntities: ListEntities
}

const toFieldInput = (f: BlingFieldDef): FieldDefinitionInput => ({
  name: f.name,
  required: f.required ?? false,
  type: f.type,
})

// ACL bridge: bling EntityCatalog -> data CreateEntity/AddField/DescribeEntity/
// ListEntities. Ensures each of the 17 mirror entities (and their fields)
// exists in the data/catalog context. Idempotent -- SeedBlingEntitiesService
// runs ensureEntity/ensureRelationFields on every sync, so both methods must
// tolerate being called against an already-seeded catalog: ensureEntity looks
// the slug up via listEntities before creating, ensureRelationFields skips any
// relation field already present on the entity.
export class DataEntityCatalog implements EntityCatalog {
  private readonly createEntity: CreateEntity
  private readonly addField: AddField
  private readonly describeEntity: DescribeEntity
  private readonly listEntities: ListEntities

  constructor(deps: DataEntityCatalogDeps) {
    this.createEntity = deps.createEntity
    this.addField = deps.addField
    this.describeEntity = deps.describeEntity
    this.listEntities = deps.listEntities
  }

  async ensureEntity(
    def: BlingEntityDef,
    slugToId: Map<string, string>,
  ): Promise<Result<{ entityId: string }>> {
    const existing = await this.listEntities.execute()
    const found = existing.find((e) => e.slug === def.slug)
    if (found) {
      slugToId.set(def.slug, found.id)
      return ok({ entityId: found.id })
    }

    const fields = def.fields.filter((f) => f.type.kind !== 'relation').map(toFieldInput)
    const created = await this.createEntity.execute({ name: def.name, fields })
    if (!created.ok) return fail(created.error)
    slugToId.set(def.slug, created.value.id)
    return ok({ entityId: created.value.id })
  }

  async ensureRelationFields(def: BlingEntityDef, slugToId: Map<string, string>): Promise<Result<void>> {
    const entityId = slugToId.get(def.slug)
    if (!entityId) return fail(`DataEntityCatalog: unknown entity for slug "${def.slug}"`)

    const description = await this.describeEntity.execute(entityId)
    const existingNames = new Set((description?.fields ?? []).map((f) => f.name))

    for (const field of def.fields) {
      if (field.type.kind !== 'relation') continue
      if (existingNames.has(field.name)) continue
      if (!field.relationTargetSlug) {
        return fail(`DataEntityCatalog: relation field "${field.name}" has no relationTargetSlug`)
      }
      const targetEntityId = slugToId.get(field.relationTargetSlug)
      if (!targetEntityId) {
        return fail(`DataEntityCatalog: unresolved relation target slug "${field.relationTargetSlug}"`)
      }

      const added = await this.addField.execute({
        entityId,
        name: field.name,
        required: field.required ?? false,
        type: { kind: 'relation', targetEntityId },
      })
      if (!added.ok) return fail(added.error)
    }

    return ok(undefined)
  }
}
