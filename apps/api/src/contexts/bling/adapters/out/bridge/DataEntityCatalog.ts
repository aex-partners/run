import { Result, ok, fail } from '@/shared/kernel/Result'
import { BlingEntityDef, BlingFieldDef, BlingFieldTypeConfig } from '@/contexts/bling/domain/mirror/BlingEntitySchema'
import { EntityCatalog } from '@/contexts/bling/application/ports/out/EntityCatalog'

// Local field-definition shape handed to data's CreateEntity/AddField in-ports.
// Structurally identical to the slice of data's FieldDefinitionInput/
// AddFieldCommand this bridge uses -- kept local (not imported) so this adapter
// never crosses the context boundary at the type level; the concrete data
// in-ports injected by main/wiring/bling.ts satisfy these shapes structurally.
interface FieldInputLike {
  name: string
  required: boolean
  type: BlingFieldTypeConfig
}

export interface DataEntityCatalogDeps {
  createEntity: {
    execute(cmd: { name: string; fields?: FieldInputLike[] }): Promise<Result<{ id: string; slug: string }>>
  }
  addField: {
    execute(cmd: {
      entityId: string
      name: string
      required: boolean
      type: BlingFieldTypeConfig
    }): Promise<Result<{ id: string }>>
  }
  describeEntity: {
    execute(ref: string): Promise<{ fields: { name: string }[] } | null>
  }
  listEntities: {
    execute(): Promise<{ id: string; slug: string }[]>
  }
}

const toFieldInput = (f: BlingFieldDef): FieldInputLike => ({
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
  private readonly createEntity: DataEntityCatalogDeps['createEntity']
  private readonly addField: DataEntityCatalogDeps['addField']
  private readonly describeEntity: DataEntityCatalogDeps['describeEntity']
  private readonly listEntities: DataEntityCatalogDeps['listEntities']

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
