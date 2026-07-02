// JSON value algebra. Used as the boundary type for dynamic data (record
// values, flow variables, tool input/output) — anything whose shape is decided
// at runtime rather than compile time.
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type JsonObject = { [key: string]: Json }

export const isJsonObject = (v: Json): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

// Read a dotted path ("step1.output.total") out of a JSON object. Returns
// undefined when any segment is missing. Pure.
export const getPath = (root: JsonObject, path: string): Json | undefined => {
  let cur: Json | undefined = root
  for (const seg of path.split('.')) {
    if (cur === undefined || cur === null || typeof cur !== 'object' || Array.isArray(cur)) {
      return undefined
    }
    cur = cur[seg]
  }
  return cur
}
