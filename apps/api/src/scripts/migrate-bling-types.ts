// One-off: bring ALREADY-IMPORTED Bling entities in line with the corrected
// BlingEntitySchema. Two passes per entity:
//   (a) re-type each field's `type` in the entity's `fields` JSON to the schema's
//       kind (text -> phone/percent/select/image/address, etc.), preserving field
//       ids, display names and relation configs. Flat address fields are dropped
//       and replaced by the composite `address` fields.
//   (b) rewrite each record's `data`: fold the flat address keys into a single
//       `{ logradouro, numero, ... }` object under the new field, and delete the
//       old flat keys.
// Idempotent: re-running is a no-op once migrated. Fields not in the schema (e.g.
// manually added) are left untouched, except the known flat address keys.
//
// Run (from apps/api), LOCAL first:
//   DATABASE_URL='postgres://aex:aex@localhost:55432/aex' npx tsx src/scripts/migrate-bling-types.ts
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import dotenv from 'dotenv'
dotenv.config({ path: resolve(process.cwd(), '../../.env') })
dotenv.config()

import { eq } from 'drizzle-orm'
import { makeDb } from '@/platform/db/client'
import { loadEnv } from '@/platform/config/env'
import { entities, entityRecords } from '@/platform/db/schema'
import { BLING_ENTITIES } from '@/contexts/bling/domain/mirror/BlingEntitySchema'
import { Json } from '@/shared/domain/Json'

// domain kind -> AEX on-disk type string (checkbox/relationship differ; rest 1:1).
const aexType = (kind: string): string =>
  kind === 'boolean' ? 'checkbox' : kind === 'relation' ? 'relationship' : kind

// AEX field object (the shape stored in entities.fields JSON).
interface AexField {
  id: string
  name: string
  slug: string
  type: string
  required?: boolean
  options?: { value: string; label: string; color?: string }[]
  [k: string]: Json | undefined
}

// Flat address keys that the composite `address` fields replace (dropped on migrate).
const FLAT_DROP = new Set<string>([
  'endereco_geral_logradouro', 'endereco_geral_cep', 'endereco_geral_bairro', 'endereco_geral_municipio',
  'endereco_geral_uf', 'endereco_geral_numero', 'endereco_geral_complemento',
  'endereco_cobranca_logradouro', 'endereco_cobranca_cep', 'endereco_cobranca_bairro', 'endereco_cobranca_municipio',
  'endereco_cobranca_uf', 'endereco_cobranca_numero', 'endereco_cobranca_complemento',
  'etiqueta_logradouro', 'etiqueta_numero', 'etiqueta_complemento', 'etiqueta_municipio', 'etiqueta_uf',
  'etiqueta_cep', 'etiqueta_bairro', 'etiqueta_pais',
])

// Nice display names for the new composite address fields.
const ADDR_LABEL: Record<string, string> = {
  endereco_geral: 'Endereço geral',
  endereco_cobranca: 'Endereço cobrança',
  etiqueta_endereco: 'Endereço etiqueta',
}

// Per-entity record migrations: build `target` from the flat source keys.
const ADDR_BUILD: Record<string, { target: string; keys: Record<string, string> }[]> = {
  bling_contatos: [
    {
      target: 'endereco_geral',
      keys: {
        logradouro: 'endereco_geral_logradouro', numero: 'endereco_geral_numero',
        complemento: 'endereco_geral_complemento', bairro: 'endereco_geral_bairro',
        cep: 'endereco_geral_cep', municipio: 'endereco_geral_municipio', uf: 'endereco_geral_uf',
      },
    },
    {
      target: 'endereco_cobranca',
      keys: {
        logradouro: 'endereco_cobranca_logradouro', numero: 'endereco_cobranca_numero',
        complemento: 'endereco_cobranca_complemento', bairro: 'endereco_cobranca_bairro',
        cep: 'endereco_cobranca_cep', municipio: 'endereco_cobranca_municipio', uf: 'endereco_cobranca_uf',
      },
    },
  ],
  bling_pedidos_venda: [
    {
      target: 'etiqueta_endereco',
      keys: {
        logradouro: 'etiqueta_logradouro', numero: 'etiqueta_numero', complemento: 'etiqueta_complemento',
        bairro: 'etiqueta_bairro', cep: 'etiqueta_cep', municipio: 'etiqueta_municipio',
        uf: 'etiqueta_uf', pais: 'etiqueta_pais',
      },
    },
  ],
}

const str = (v: unknown): string | null => {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

async function main() {
  const env = loadEnv()
  const db = makeDb(env.DATABASE_URL)

  for (const def of BLING_ENTITIES) {
    const [row] = await db.select().from(entities).where(eq(entities.slug, def.slug)).limit(1)
    if (!row) {
      console.log(`[skip] entity not found: ${def.slug}`)
      continue
    }

    // ---- (a) re-type the entity's fields JSON ----
    const desired = new Map(def.fields.map((f) => [f.name, f]))
    let fields: AexField[]
    try {
      fields = JSON.parse(row.fields) as AexField[]
    } catch {
      console.log(`[skip] unparseable fields JSON: ${def.slug}`)
      continue
    }
    const present = new Set(fields.map((f) => f.slug))
    const out: AexField[] = []
    let retyped = 0
    for (const f of fields) {
      if (FLAT_DROP.has(f.slug)) continue // replaced by composite address
      const d = desired.get(f.slug)
      if (d && d.type.kind !== 'relation') {
        const t = aexType(d.type.kind)
        if (f.type !== t) {
          f.type = t
          retyped++
        }
        if (d.type.kind === 'select' && !Array.isArray(f.options)) f.options = []
      }
      out.push(f)
    }
    // add missing composite address (and any other new non-relation) fields
    for (const [slug, d] of desired) {
      if (present.has(slug) || d.type.kind === 'relation') continue
      out.push({
        id: randomUUID(),
        name: ADDR_LABEL[slug] ?? slug,
        slug,
        type: aexType(d.type.kind),
        required: d.required ?? false,
        ...(d.type.kind === 'select' ? { options: [] } : {}),
      })
    }
    const newFieldsJson = JSON.stringify(out)
    if (newFieldsJson !== row.fields) {
      await db.update(entities).set({ fields: newFieldsJson }).where(eq(entities.id, row.id))
    }

    // ---- (b) rewrite record data (address fold) ----
    const builds = ADDR_BUILD[def.slug]
    let recChanged = 0
    let recTotal = 0
    if (builds) {
      const PAGE = 1000
      let offset = 0
      for (;;) {
        const recs = await db
          .select({ id: entityRecords.id, data: entityRecords.data })
          .from(entityRecords)
          .where(eq(entityRecords.entityId, row.id))
          .limit(PAGE)
          .offset(offset)
        if (recs.length === 0) break
        const updates: { id: string; data: string }[] = []
        for (const r of recs) {
          recTotal++
          let data: Record<string, Json>
          try {
            data = JSON.parse(r.data) as Record<string, Json>
          } catch {
            continue
          }
          let touched = false
          for (const b of builds) {
            const obj: Record<string, string> = {}
            for (const [part, srcKey] of Object.entries(b.keys)) {
              const v = str(data[srcKey])
              if (v !== null) obj[part] = v
              if (srcKey in data) {
                delete data[srcKey]
                touched = true
              }
            }
            const next: Json = Object.keys(obj).length ? obj : null
            if (JSON.stringify(data[b.target] ?? null) !== JSON.stringify(next)) {
              data[b.target] = next
              touched = true
            }
          }
          if (touched) updates.push({ id: r.id, data: JSON.stringify(data) })
        }
        const CHUNK = 200
        for (let i = 0; i < updates.length; i += CHUNK) {
          await Promise.all(
            updates.slice(i, i + CHUNK).map((u) =>
              db.update(entityRecords).set({ data: u.data }).where(eq(entityRecords.id, u.id)),
            ),
          )
        }
        recChanged += updates.length
        offset += recs.length
        if (recs.length < PAGE) break
      }
    }

    console.log(
      `[ok] ${def.slug}: retyped ${retyped} field(s)` +
        (builds ? `, address-folded ${recChanged}/${recTotal} record(s)` : ''),
    )
  }

  console.log('[migrate] done')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
