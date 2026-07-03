// One-off: create real `relation` fields across the seeded Buenaça entities and
// backfill every source record's relation to the matching target record id.
//
// For each LINK below it (a) ensures a NEW relation field exists on the SOURCE
// entity's `fields` JSON (added through the domain so the on-disk AEX shape —
// type 'relationship' + relationshipEntityId/Name — is written by AexFieldCodec),
// and (b) sets each source record's data[relSlug] to the matched TARGET record id
// (empty when no match). Idempotent: an existing relation field is not duplicated,
// and the backfill re-runs (overwrites) each source record's value.
//
// Run (from apps/api):
//   DATABASE_URL='postgres://aex:aex@localhost:55432/aex' npx tsx src/scripts/seed-relations.ts
import { resolve } from 'node:path'
import dotenv from 'dotenv'
// The env schema needs REDIS_URL/BETTER_AUTH_* etc.; load the repo-root .env
// (run cwd is apps/api). dotenv never overrides already-set vars, so an inline
// DATABASE_URL on the command line still wins.
dotenv.config({ path: resolve(process.cwd(), '../../.env') })
dotenv.config()

import { eq } from 'drizzle-orm'
import { makeDb } from '@/platform/db/client'
import { loadEnv } from '@/platform/config/env'
import { entityRecords } from '@/platform/db/schema'
import { DrizzleEntityRepository } from '@/contexts/data/adapters/out/persistence/DrizzleEntityRepository'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { Json } from '@/shared/domain/Json'

// ---- normalizers for match keys ----
const digits = (v: unknown): string => String(v ?? '').replace(/\D/g, '')
const code = (v: unknown): string => String(v ?? '').trim().toUpperCase()
const name = (v: unknown): string => String(v ?? '').trim().toLowerCase()

type Norm = (v: unknown) => string

interface Link {
  source: string
  target: string
  relSlug: string
  relName: string
  // Target keys to index (data slug), and source keys to try in order.
  targetKeys: string[]
  sourceKeys: string[]
  normalize: Norm
}

// The six links (source entity -> target entity) and their match keys.
const LINKS: Link[] = [
  {
    source: 'Contas a Receber', target: 'Contatos',
    relSlug: 'rel_cliente', relName: 'Cliente (vínculo)',
    targetKeys: ['cnpj_cpf'], sourceKeys: ['cpf_cnpj'], normalize: digits,
  },
  {
    source: 'Contas a Pagar', target: 'Contatos',
    relSlug: 'rel_fornecedor', relName: 'Fornecedor (vínculo)',
    targetKeys: ['cnpj_cpf'], sourceKeys: ['cpf_cnpj'], normalize: digits,
  },
  {
    source: 'Pedidos de Venda', target: 'Contatos',
    relSlug: 'rel_comprador', relName: 'Comprador (vínculo)',
    targetKeys: ['cnpj_cpf'], sourceKeys: ['cpf_cnpj_comprador'], normalize: digits,
  },
  {
    source: 'Pedidos de Venda', target: 'Produtos',
    relSlug: 'rel_produto', relName: 'Produto (vínculo)',
    targetKeys: ['codigo', 'gtin_ean'], sourceKeys: ['sku', 'produto'], normalize: code,
  },
  {
    source: 'Estoque', target: 'Produtos',
    relSlug: 'rel_produto', relName: 'Produto (vínculo)',
    targetKeys: ['codigo', 'gtin_ean'], sourceKeys: ['codigo_produto', 'gtin'], normalize: code,
  },
  {
    source: 'Produtos', target: 'Contatos',
    relSlug: 'rel_fornecedor', relName: 'Fornecedor (vínculo)',
    targetKeys: ['nome'], sourceKeys: ['fornecedor'], normalize: name,
  },
]

type Rec = { id: string; data: Record<string, Json> }

async function main() {
  const env = loadEnv()
  const db = makeDb(env.DATABASE_URL)
  const entityRepo = new DrizzleEntityRepository(db)

  // cache: entity name -> resolved EntityDefinition (id + fields)
  const entityByName = new Map<string, EntityDefinition>()
  const resolveEntity = async (n: string): Promise<EntityDefinition> => {
    const cached = entityByName.get(n)
    if (cached) return cached
    const e = await entityRepo.findByRef(n)
    if (!e) throw new Error(`entity not found: ${n}`)
    entityByName.set(n, e)
    return e
  }

  // load all { id, data } rows for an entity id
  const loadRecords = async (entityId: string): Promise<Rec[]> => {
    const rows = await db
      .select({ id: entityRecords.id, data: entityRecords.data })
      .from(entityRecords)
      .where(eq(entityRecords.entityId, entityId))
    return rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) as Record<string, Json> }))
  }

  for (const link of LINKS) {
    const sourceEntity = await resolveEntity(link.source)
    const targetEntity = await resolveEntity(link.target)

    // (a) ensure the relation field exists on the SOURCE entity (idempotent).
    const exists = sourceEntity.fields().some((f) => f.name.value === link.relSlug)
    if (!exists) {
      const added = sourceEntity.addField(
        {
          name: link.relSlug,
          displayName: link.relName,
          required: false,
          id: link.relSlug,
          type: {
            kind: 'relation',
            targetEntityId: targetEntity.id.value,
            targetEntityName: targetEntity.name,
          },
        },
        new Date(),
      )
      if (!added.ok) throw new Error(`addField ${link.source}.${link.relSlug}: ${added.error}`)
      await entityRepo.save(sourceEntity)
      console.log(`[rel] +field ${link.source}.${link.relSlug} -> ${link.target}`)
    } else {
      console.log(`[rel] field ${link.source}.${link.relSlug} already present (re-backfill)`)
    }

    // (b) build the target index (normalized key -> target id; first wins).
    const targetRecords = await loadRecords(targetEntity.id.value)
    const index = new Map<string, string>()
    for (const t of targetRecords) {
      for (const key of link.targetKeys) {
        const k = link.normalize(t.data[key])
        if (k && !index.has(k)) index.set(k, t.id)
      }
    }

    // (b) backfill each source record (re-read fresh so a prior link's writes are seen).
    const sourceRecords = await loadRecords(sourceEntity.id.value)
    let matched = 0
    const updates: { id: string; data: string }[] = []
    for (const s of sourceRecords) {
      let hit: string | undefined
      for (const key of link.sourceKeys) {
        const k = link.normalize(s.data[key])
        if (!k) continue
        hit = index.get(k)
        if (hit) break
      }
      if (hit) matched++
      updates.push({ id: s.id, data: JSON.stringify({ ...s.data, [link.relSlug]: hit ?? null }) })
    }

    // apply updates in chunks (direct value write; no CAS/version bump needed).
    const chunk = 200
    for (let i = 0; i < updates.length; i += chunk) {
      await Promise.all(
        updates.slice(i, i + chunk).map((u) =>
          db.update(entityRecords).set({ data: u.data }).where(eq(entityRecords.id, u.id)),
        ),
      )
    }
    console.log(
      `[rel] ${link.source} -> ${link.target} (${link.relSlug}): ${matched}/${sourceRecords.length} matched`,
    )
  }

  console.log('[rel] done')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
