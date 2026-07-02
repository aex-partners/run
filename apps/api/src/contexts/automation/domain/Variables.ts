import { Json, JsonObject } from '@/shared/domain/Json'

// Pure variable resolution, ported 1:1 from `flow-engine/variable-service.ts`.
// Resolves "{{step_name.output.field}}" / "{{items[0].name}}" references in an
// action input against the accumulated run state.
//   - a string that is EXACTLY "{{path}}" resolves to the referenced VALUE
//     (preserving its type)
//   - "{{path}}" embedded in longer text is string-substituted (objects are
//     JSON.stringify'd; null/undefined become "")
// Recurses into arrays and objects. No IO.

const VARIABLE_PATTERN = /\{\{(.+?)\}\}/g

export function resolveVariables(input: Json, state: JsonObject): Json {
  if (input === null) return input

  if (typeof input === 'string') {
    return resolveString(input, state)
  }

  if (Array.isArray(input)) {
    return input.map((item) => resolveVariables(item, state))
  }

  if (typeof input === 'object') {
    const result: JsonObject = {}
    for (const [key, value] of Object.entries(input)) {
      result[key] = resolveVariables(value, state)
    }
    return result
  }

  return input
}

function resolveString(str: string, state: JsonObject): Json {
  // The entire string is a single reference: return the resolved value directly.
  const singleMatch = str.match(/^\{\{(.+?)\}\}$/)
  if (singleMatch) {
    const value = evaluatePath(singleMatch[1]!.trim(), state)
    return value === undefined ? null : value
  }

  // String interpolation: replace each {{...}} with its stringified value.
  return str.replace(VARIABLE_PATTERN, (_match, path: string) => {
    const value = evaluatePath(path.trim(), state)
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  })
}

// Evaluate a dot/bracket path against the state object.
//   "step_1.output.items[0].name"
function evaluatePath(path: string, state: JsonObject): Json | undefined {
  const parts = parsePath(path)
  let current: Json | undefined = state

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined

    if (Array.isArray(current)) {
      const index = parseInt(part, 10)
      if (Number.isNaN(index)) return undefined
      current = current[index]
    } else {
      current = current[part]
    }
  }

  return current
}

// "step_1.output.items[0].name" -> ["step_1", "output", "items", "0", "name"]
function parsePath(path: string): string[] {
  const parts: string[] = []
  let current = ''

  for (let i = 0; i < path.length; i++) {
    const ch = path[i]
    if (ch === '.' || ch === '[' || ch === ']') {
      if (current) parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }

  if (current) parts.push(current)
  return parts
}
