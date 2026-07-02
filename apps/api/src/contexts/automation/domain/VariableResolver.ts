import { Json, JsonObject, getPath } from '@/shared/domain/Json'

// Pure interpolation of "{{path}}" references against the run variables.
//   - a string that is EXACTLY "{{path}}" resolves to the referenced value
//     (preserving its type: number, object, ...)
//   - "{{path}}" embedded in longer text is string-substituted
// Recurses into arrays and objects. No IO.
export const resolveTemplate = (template: Json, vars: JsonObject): Json => {
  if (typeof template === 'string') return resolveString(template, vars)
  if (Array.isArray(template)) return template.map((t) => resolveTemplate(t, vars))
  if (template !== null && typeof template === 'object') {
    const out: JsonObject = {}
    for (const [k, v] of Object.entries(template)) out[k] = resolveTemplate(v, vars)
    return out
  }
  return template
}

const FULL = /^\{\{\s*([^}]+?)\s*\}\}$/
const PART = /\{\{\s*([^}]+?)\s*\}\}/g

const resolveString = (s: string, vars: JsonObject): Json => {
  const full = FULL.exec(s)
  if (full) {
    const value = getPath(vars, full[1]!)
    return value === undefined ? null : value
  }
  return s.replace(PART, (_m, path: string) => {
    const value = getPath(vars, path.trim())
    return value === undefined || value === null ? '' : String(value)
  })
}
