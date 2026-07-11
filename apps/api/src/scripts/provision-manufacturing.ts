// Idempotent: create the 2 manufacturing entities (work centers + routing)
// through the data in-ports. Safe to re-run. Run against a DATABASE_URL, e.g.:
//   DATABASE_URL='postgres://aex:aex@localhost:55432/aex' npx tsx src/scripts/provision-manufacturing.ts
//
// Deviates from the original sketch of calling `wireData(infra)`: wireData needs
// a full Infra (db + redis + better-auth + bullConnection), none of which the
// four ports used here (createEntity/addField/listEntities/describeEntity)
// touch. Every other script in this directory (seed-buenaca.ts,
// migrate-bling-types.ts) bypasses wireData the same way, instantiating only the
// Drizzle adapters + application services it actually needs. This mirrors that
// convention instead of pulling in Redis/better-auth for no reason.
import { makeDb } from '@/platform/db/client'
import { loadEnv } from '@/platform/config/env'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DrizzleEntityRepository } from '@/contexts/data/adapters/out/persistence/DrizzleEntityRepository'
import { DrizzleListEntities } from '@/contexts/data/adapters/out/persistence/DrizzleListEntities'
import { CreateEntityService } from '@/contexts/data/application/use-cases/CreateEntityService'
import { AddFieldService } from '@/contexts/data/application/use-cases/AddFieldService'
import { DescribeEntityService } from '@/contexts/data/application/use-cases/DescribeEntityService'
import { FieldTypeConfig } from '@/contexts/data/domain/FieldType'
import { fieldConfig, FieldSpec } from '@/scripts/schemaSpec'
import { MANUFACTURING_ENTITIES } from '@/scripts/manufacturingSchema'

const noopEvents: EventPublisher = { publish: async () => {} }
const clock: Clock = { now: () => new Date() }

async function main() {
  const env = loadEnv()
  const db = makeDb(env.DATABASE_URL)

  const entityRepo = new DrizzleEntityRepository(db)
  const listEntities = new DrizzleListEntities(db)
  const createEntity = new CreateEntityService(entityRepo, noopEvents, clock)
  const addField = new AddFieldService(entityRepo, noopEvents, clock)
  const describeEntity = new DescribeEntityService(entityRepo)

  const idBySlug = async (slug: string): Promise<string | null> =>
    (await listEntities.execute()).find((e) => e.slug === slug)?.id ?? null

  // 1) create the 2 manufacturing entities (idempotent by slug), fieldless
  //    first so `operacoes.centro` can resolve `centros_de_trabalho`, then add
  //    fields below.
  //
  //    `name` is passed as the pretty `displayName` so the entity shows a proper
  //    Portuguese label in the Database sidebar (the frontend renders
  //    entity.name). CreateEntityCommand exposes no separate slug param:
  //    EntityDefinition derives the slug from `name` via Slug.from. Each
  //    displayName is chosen so it derives to exactly `spec.slug` -- an
  //    invariant locked by manufacturingSchema.test.ts -- so the idempotent
  //    skip-by-slug check below (and every future re-run) keeps working.
  for (const spec of MANUFACTURING_ENTITIES) {
    if (await idBySlug(spec.slug)) {
      console.log(`skip entity ${spec.slug}`)
      continue
    }
    const r = await createEntity.execute({ name: spec.displayName, fields: [] })
    if (!r.ok) throw new Error(`createEntity ${spec.slug}: ${r.error}`)
    console.log(`created entity ${spec.slug}`)
  }

  // 2) add fields to an entity (skip fields already present, by slug)
  const addFieldsTo = async (entitySlug: string, fields: FieldSpec[]) => {
    const entityId = await idBySlug(entitySlug)
    if (!entityId) throw new Error(`entity missing: ${entitySlug}`)
    const existing = new Set((await describeEntity.execute(entityId))?.fields.map((f) => f.slug) ?? [])
    for (const f of fields) {
      if (existing.has(f.slug)) {
        console.log(`skip field ${entitySlug}.${f.slug}`)
        continue
      }
      const targetId = f.targetSlug ? await idBySlug(f.targetSlug) : null
      const type = fieldConfig(f, () => targetId) as FieldTypeConfig
      const rr = await addField.execute({ entityId, name: f.slug, displayName: f.displayName, required: false, type })
      if (!rr.ok) throw new Error(`addField ${entitySlug}.${f.slug}: ${rr.error}`)
      console.log(`added field ${entitySlug}.${f.slug}`)
    }
  }

  for (const spec of MANUFACTURING_ENTITIES) await addFieldsTo(spec.slug, spec.fields)

  console.log('provision-manufacturing done')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
