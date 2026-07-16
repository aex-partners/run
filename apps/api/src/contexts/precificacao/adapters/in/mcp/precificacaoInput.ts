import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'

// Parsing compartilhado das MCP tools de precificação (definir_canal /
// definir_parametros_preco / definir_condicao_financeira / definir_lucro / gerar_precos /
// consultar_preco / precos_desatualizados). Transforma o JSON frouxo do Eric em comandos
// validados, devolvendo falhas em `Result` (nunca lançando), com mensagens acionáveis.
// Espelha estoque/adapters/in/mcp/estoqueInput.ts. Não existe inputSchema em
// ToolDefinition: toda guarda é feita à mão aqui.

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

// Nullable string field: absent/null both collapse to null.
export const nullableString = (tool: string, obj: JsonObject, field: string): Result<string | null> => {
  const v = obj[field]
  if (v === undefined || v === null) return ok(null)
  return typeof v === 'string' ? ok(v) : fail(`${tool}: ${field} must be a string or null`)
}

// Required finite number field (rejects NaN/Infinity and numeric strings).
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

// Lista opcional de ids (gerar_precos.skuIds).
export const optStringArray = (tool: string, obj: JsonObject, field: string): Result<string[] | undefined> => {
  const v = obj[field]
  if (v === undefined || v === null) return ok(undefined)
  if (!Array.isArray(v)) return fail(`${tool}: ${field} must be an array of strings`)
  const out: string[] = []
  for (const [i, raw] of v.entries()) {
    if (typeof raw !== 'string' || raw.length === 0) return fail(`${tool}: ${field}[${i}] must be a non-empty string`)
    out.push(raw)
  }
  return ok(out)
}

// Percent é FRAÇÃO em [0,1]. Recusa "10" no lugar de "0,10" (viraria 1000% e a marcação
// estouraria). Obrigatório.
export const reqPercent = (tool: string, obj: JsonObject, field: string): Result<number> => {
  const v = obj[field]
  if (typeof v !== 'number' || !Number.isFinite(v)) return fail(`${tool}: ${field} (number) obrigatório`)
  if (v < 0 || v > 1) return fail(`${tool}: ${field} = ${v} fora da faixa. Percentual é FRAÇÃO: 10% é 0,10, não 10.`)
  return ok(v)
}
// Opcional: ausente/nulo -> undefined; fora da faixa -> erro.
export const optPercent = (tool: string, obj: JsonObject, field: string): Result<number | undefined> => {
  const v = obj[field]
  if (v === undefined || v === null) return ok(undefined)
  return reqPercent(tool, obj, field)
}
