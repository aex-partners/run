import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'

// Shared input parsing for the manufacturing MCP tools (definir_centro_trabalho /
// definir_operacao / publicar_roteiro / obter_roteiro). Turns the AI's (Eric's)
// loosely-typed JSON into validated commands, returning `Result` failures (never
// throwing) with actionable messages. Mirrors costing/adapters/in/mcp/costingInput.ts
// so the tools stay thin and consistent. There is no inputSchema in ToolDefinition:
// every guard is hand-rolled here.

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

// Nullable string field: absent/null both collapse to null (the in-port takes
// `string | null` for an optional foreign key, e.g. operação sem centro).
export const nullableString = (tool: string, obj: JsonObject, field: string): Result<string | null> => {
  const v = obj[field]
  if (v === undefined || v === null) return ok(null)
  return typeof v === 'string' ? ok(v) : fail(`${tool}: ${field} must be a string or null`)
}

// Required finite number field (rejects NaN/Infinity and numeric strings: the AI
// must send a real number, otherwise a silent 0 would corrupt the cost).
export const reqNumber = (tool: string, obj: JsonObject, field: string): Result<number> => {
  const v = obj[field]
  return typeof v === 'number' && Number.isFinite(v) ? ok(v) : fail(`${tool}: ${field} (number) obrigatório`)
}

// Optional finite number field: ok(undefined) when absent/null.
export const optNumber = (tool: string, obj: JsonObject, field: string): Result<number | undefined> => {
  const v = obj[field]
  if (v === undefined || v === null) return ok(undefined)
  return typeof v === 'number' && Number.isFinite(v) ? ok(v) : fail(`${tool}: ${field} must be a number`)
}

// Optional boolean field: ok(undefined) when absent/null.
export const optBoolean = (tool: string, obj: JsonObject, field: string): Result<boolean | undefined> => {
  const v = obj[field]
  if (v === undefined || v === null) return ok(undefined)
  return typeof v === 'boolean' ? ok(v) : fail(`${tool}: ${field} must be a boolean`)
}

// Optional map of tamanho -> minutos ({ "P": 12, "M": 13 }). Every value must be a
// finite number; a bad entry fails loudly instead of silently dropping the tempo.
export const optNumberMap = (
  tool: string,
  obj: JsonObject,
  field: string,
): Result<Record<string, number> | undefined> => {
  const v = obj[field]
  if (v === undefined || v === null) return ok(undefined)
  if (!isJsonObject(v)) return fail(`${tool}: ${field} must be an object of { tamanho: minutos }`)
  const out: Record<string, number> = {}
  for (const [k, raw] of Object.entries(v)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return fail(`${tool}: ${field}.${k} must be a number`)
    out[k] = raw
  }
  return ok(out)
}
