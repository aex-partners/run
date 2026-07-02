import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'

// Shared parsing for the Bling read tools' input. All three accept the same
// optional list filters: `{ pagina?, limite?, pesquisa? }` (plus `id?` on the
// contato tool). PURE, defensive: unknown/invalid values are dropped rather than
// throwing, so Eric's loosely-typed calls degrade to sensible defaults.
export interface BlingToolInput {
  pagina?: number
  limite?: number
  pesquisa?: string
  id?: string
}

const asPositiveInt = (v: Json | undefined): number | undefined => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined
  const n = Math.floor(v)
  return n > 0 ? n : undefined
}

const asText = (v: Json | undefined): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t.length > 0 ? t : undefined
}

// Returns null when the input is not a JSON object at all (a hard shape error the
// tool reports); otherwise a bag of the recognised, cleaned fields.
export const parseBlingInput = (input: Json): BlingToolInput | null => {
  if (!isJsonObject(input)) return null
  const obj: JsonObject = input
  return {
    pagina: asPositiveInt(obj.pagina),
    limite: asPositiveInt(obj.limite),
    pesquisa: asText(obj.pesquisa),
    id: asText(obj.id),
  }
}
