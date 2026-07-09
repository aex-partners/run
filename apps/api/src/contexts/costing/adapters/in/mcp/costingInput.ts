import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'

// Shared input parsing for the costing MCP tools (explodir_ficha / recalcular_custo /
// publicar_revisao_ficha / historico_custo). Turns the AI's (Eric's) loosely-typed
// JSON into validated commands, returning `Result` failures (never throwing) with
// actionable messages. Kept here so the four tools stay thin and consistent.

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
