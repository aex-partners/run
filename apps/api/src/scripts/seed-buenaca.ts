// Seed a test database from the Buenaça Bling CSV backup. Creates an owner user,
// marks setup complete, and imports each CSV as a dynamic entity + records via
// the real data-context use-cases (so the stored shape is exactly what the app
// reads). Run with the DB env vars set (see the npm script).
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { parse } from 'csv-parse/sync'
import { eq } from 'drizzle-orm'
import { makeDb } from '@/platform/db/client'
import { makeAuth } from '@/platform/auth/better-auth'
import { loadEnv } from '@/platform/config/env'
import * as schema from '@/platform/db/schema'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { Clock } from '@/shared/kernel/Clock'
import { DrizzleEntityRepository } from '@/contexts/data/adapters/out/persistence/DrizzleEntityRepository'
import { DrizzleRecordRepository } from '@/contexts/data/adapters/out/persistence/DrizzleRecordRepository'
import { CreateEntityService } from '@/contexts/data/application/use-cases/CreateEntityService'
import { InsertRecordService } from '@/contexts/data/application/use-cases/InsertRecordService'
import { FieldDefinitionInput } from '@/contexts/data/application/ports/in/FieldDefinitionInput'
import { FieldTypeConfig } from '@/contexts/data/domain/FieldType'
import { Json, JsonObject } from '@/shared/domain/Json'

// Local default points at the Bling export in Downloads; in the container we set
// SEED_DATA_DIR to the CSVs bundled under apps/api/seed-data/buenaca.
const BACKUP = process.env.SEED_DATA_DIR ?? '/home/ahlert/Downloads/Old/Backup Bling'

interface CsvSpec {
  file: string
  entity: string
  cap: number
  exclude?: (row: Record<string, string>) => boolean
}

const SPECS: CsvSpec[] = [
  { file: 'contatos.csv', entity: 'Contatos', cap: 600 },
  { file: 'produtos.csv', entity: 'Produtos', cap: 1200, exclude: (r) => valueOf(r, /situa/i)?.toLowerCase() === 'excluído' },
  { file: 'pedidos_venda.csv', entity: 'Pedidos de Venda', cap: 1200 },
  { file: 'contas_receber.csv', entity: 'Contas a Receber', cap: 1500 },
  { file: 'contas_pagar.csv', entity: 'Contas a Pagar', cap: 1500 },
  { file: 'saldos_estoque.csv', entity: 'Estoque', cap: 1200 },
]

function valueOf(row: Record<string, string>, re: RegExp): string | undefined {
  const key = Object.keys(row).find((k) => re.test(k))
  return key ? row[key] : undefined
}

function slugify(h: string): string {
  const s = h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, 'f_$1')
  return s || 'field'
}

function fieldKind(slug: string): FieldTypeConfig {
  if (/(^|_)(data|vencimento|emissao|liquidacao)(_|$)/.test(slug)) return { kind: 'date' }
  if (/(preco|valor|estoque|saldo|balanco|custo|quantidade|qtde|total|peso)/.test(slug)) return { kind: 'number' }
  return { kind: 'text' }
}

function parseBrNumber(v: string): number | null {
  const cleaned = v.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  if (cleaned === '' || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseBrDate(v: string): string | null {
  const m = v.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function coerce(raw: string | undefined, kind: FieldTypeConfig['kind']): Json {
  const v = (raw ?? '').trim()
  if (v === '') return null
  if (kind === 'number') return parseBrNumber(v)
  if (kind === 'date') return parseBrDate(v)
  return v.length > 500 ? v.slice(0, 500) : v
}

const noopEvents: EventPublisher = { publish: async () => {} }
const clock: Clock = { now: () => new Date() }

async function main() {
  const env = loadEnv()
  const db = makeDb(env.DATABASE_URL)
  const auth = makeAuth(db, env)

  // 1) owner user
  const email = 'admin@aex.app'
  const password = 'buenaca123'
  try {
    await auth.api.signUpEmail({ body: { email, password, name: 'Admin Buenaça' } })
    console.log(`[seed] created user ${email}`)
  } catch (e) {
    console.log(`[seed] signUp skipped (${(e as Error).message})`)
  }
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1)
  if (!user) throw new Error('seed: user not created')
  await db.update(schema.users).set({ role: 'owner' }).where(eq(schema.users.id, user.id))
  const userId = user.id

  // 2) setup complete + company
  for (const [key, value] of [['system.setupComplete', 'true'], ['company.orgName', 'Buenaça']] as const) {
    await db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } })
  }
  console.log('[seed] setup marked complete')

  // 3) entities + records
  const entityRepo = new DrizzleEntityRepository(db)
  const recordRepo = new DrizzleRecordRepository(db)
  const createEntity = new CreateEntityService(entityRepo, noopEvents, clock)
  const insertRecord = new InsertRecordService(entityRepo, recordRepo, noopEvents, clock)

  for (const spec of SPECS) {
    const text = readFileSync(`${BACKUP}/${spec.file}`, 'utf8')
    const rows = parse(text, {
      delimiter: ';',
      columns: true,
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_records_with_error: true,
      trim: true,
    }) as Record<string, string>[]

    const headers = Object.keys(rows[0] ?? {}).filter((h) => h && h.trim() !== '')
    const seen = new Set<string>()
    const fields: { header: string; slug: string; kind: FieldTypeConfig }[] = []
    for (const h of headers) {
      let slug = slugify(h)
      let n = 2
      while (seen.has(slug)) slug = `${slugify(h)}_${n++}`
      seen.add(slug)
      fields.push({ header: h, slug, kind: fieldKind(slug) })
    }

    const fieldDefs: FieldDefinitionInput[] = fields.map((f) => ({
      name: f.slug,
      displayName: f.header,
      required: false,
      type: f.kind,
    }))

    const created = await createEntity.execute({ name: spec.entity, createdBy: userId, fields: fieldDefs })
    if (!created.ok) {
      console.warn(`[seed] entity ${spec.entity} failed: ${created.error}`)
      continue
    }
    const entityId = created.value.id

    const chosen = rows.filter((r) => !spec.exclude?.(r)).slice(0, spec.cap)
    let ok = 0
    let failed = 0
    const chunkSize = 100
    for (let i = 0; i < chosen.length; i += chunkSize) {
      const chunk = chosen.slice(i, i + chunkSize)
      await Promise.all(
        chunk.map(async (row) => {
          const data: JsonObject = {}
          for (const f of fields) data[f.slug] = coerce(row[f.header], f.kind.kind)
          const r = await insertRecord.execute({ entityId, data, createdBy: userId })
          if (r.ok) ok++
          else failed++
        }),
      )
    }
    console.log(`[seed] ${spec.entity}: ${ok} records (${failed} failed), ${fields.length} fields`)
  }

  console.log('[seed] done')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
