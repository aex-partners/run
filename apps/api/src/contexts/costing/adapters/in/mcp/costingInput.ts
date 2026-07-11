import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'

// Shared input parsing for the costing MCP tools (explodir_ficha / recalcular_custo /
// publicar_revisao_ficha / historico_custo / definir_taxa_custo / custo_unitario).
// Turns the AI's (Eric's) loosely-typed JSON into validated commands, returning
// `Result` failures (never throwing) with actionable messages. Kept here so the six
// tools stay thin and consistent.

// Narrow the tool input to a JSON object.
export const asObject = (tool: string, input: Json): Result<JsonObject> =>
  isJsonObject(input) ? ok(input) : fail(`${tool}: expected an object`)

// Required non-empty string field.
export const reqString = (tool: string, obj: JsonObject, field: string): Result<string> => {
  const v = obj[field]
  return typeof v === 'string' && v.length > 0 ? ok(v) : fail(`${tool}: ${field} (string) obrigatório`)
}

// Optional string field: ok(undefined) when absent/null; fail on a non-string value.
export const optString = (tool: string, obj: JsonObject, field: string): Result<string | undefined> => {
  const v = obj[field]
  if (v === undefined || v === null) return ok(undefined)
  return typeof v === 'string' ? ok(v) : fail(`${tool}: ${field} must be a string`)
}

// Nullable string field: absent/null both collapse to null (a taxa sem escopo de
// centro é global — `centroId: null` é um valor de negócio, não um campo ausente).
export const nullableString = (tool: string, obj: JsonObject, field: string): Result<string | null> => {
  const v = obj[field]
  if (v === undefined || v === null) return ok(null)
  return typeof v === 'string' ? ok(v) : fail(`${tool}: ${field} must be a string or null`)
}

// Required finite number field (rejects NaN/Infinity and numeric strings: uma taxa
// coercida silenciosamente para 0 zeraria o custo indireto sem qualquer erro).
export const reqNumber = (tool: string, obj: JsonObject, field: string): Result<number> => {
  const v = obj[field]
  return typeof v === 'number' && Number.isFinite(v) ? ok(v) : fail(`${tool}: ${field} (number) obrigatório`)
}
