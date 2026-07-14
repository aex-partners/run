import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'

// Parsing compartilhado das MCP tools do estoque (registrar_movimento_estoque /
// saldo_estoque / historico_movimentos). Transforma o JSON frouxo do Eric em comandos
// validados, devolvendo falhas em `Result` (nunca lançando), com mensagens acionáveis.
// Espelha manufacturing/adapters/in/mcp/manufacturingInput.ts. Não existe inputSchema
// em ToolDefinition: toda guarda é feita à mão aqui.

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
