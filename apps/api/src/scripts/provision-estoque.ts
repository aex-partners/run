// Idempotente: cria as 3 entidades do estoque + acrescenta os campos de estoque a
// Produtos, pelas in-ports do contexto `data`. Seguro re-rodar. Rodar com DATABASE_URL:
//   DATABASE_URL='postgres://aex:aex@localhost:55432/aex' npx tsx src/scripts/provision-estoque.ts
//
// `movimentos_de_estoque.insumo` e `saldos_de_estoque.insumo` apontam para `produtos`,
// que já existe (espelho do Bling). Guarda explícita abaixo.
//
// Roda ANTES de provision-compras.ts: notas_de_entrada.deposito referencia `depositos`.
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
import { ESTOQUE_ENTITIES, PRODUTOS_ESTOQUE_FIELDS } from '@/scripts/estoqueSchema'
import * as schema from '@/platform/db/schema'

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

  // `entities.created_by` carrega FK para `users`, e o repositório persiste string vazia
  // quando não recebe autor, o que viola a FK. Atribui a um usuário real.
  const [autor] = await db.select().from(schema.users).limit(1)
  if (!autor) throw new Error('provision: nenhum usuário no banco para atribuir created_by')
  const createdBy = autor.id

  const idBySlug = async (slug: string): Promise<string | null> =>
    (await listEntities.execute()).find((e) => e.slug === slug)?.id ?? null

  if (!(await idBySlug('produtos'))) throw new Error('entidade produtos não existe: rode o seed antes')

  // 1) cria as entidades sem campos (idempotente por slug), para que as relações
  //    entre elas (saldos_de_estoque.deposito) resolvam no passo 2.
  for (const spec of ESTOQUE_ENTITIES) {
    if (await idBySlug(spec.slug)) { console.log(`skip entity ${spec.slug}`); continue }
    const r = await createEntity.execute({ name: spec.displayName, createdBy, fields: [] })
    if (!r.ok) throw new Error(`createEntity ${spec.slug}: ${r.error}`)
    console.log(`created entity ${spec.slug}`)
  }

  // 2) acrescenta campos (pula por slug os que já existem)
  const addFieldsTo = async (entitySlug: string, fields: FieldSpec[]) => {
    const entityId = await idBySlug(entitySlug)
    if (!entityId) throw new Error(`entity missing: ${entitySlug}`)
    const existing = new Set((await describeEntity.execute(entityId))?.fields.map((f) => f.slug) ?? [])
    for (const f of fields) {
      if (existing.has(f.slug)) { console.log(`skip field ${entitySlug}.${f.slug}`); continue }
      const targetId = f.targetSlug ? await idBySlug(f.targetSlug) : null
      const type = fieldConfig(f, () => targetId) as FieldTypeConfig
      const rr = await addField.execute({ entityId, name: f.slug, displayName: f.displayName, required: false, type })
      if (!rr.ok) throw new Error(`addField ${entitySlug}.${f.slug}: ${rr.error}`)
      console.log(`added field ${entitySlug}.${f.slug}`)
    }
  }

  for (const spec of ESTOQUE_ENTITIES) await addFieldsTo(spec.slug, spec.fields)
  await addFieldsTo('produtos', PRODUTOS_ESTOQUE_FIELDS)

  console.log('provision-estoque done')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
