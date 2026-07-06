// Pure Bling value normalizers. Bling returns "0000-00-00" for null dates and
// "" for absent strings; collapse both to null so typed fields stay clean.
export function nDate(s: string | undefined | null): string | null {
  if (!s) return null
  if (s === '0000-00-00' || s.startsWith('0000-')) return null
  return s
}

export function nStr(s: unknown): string | null {
  if (s === undefined || s === null) return null
  const str = String(s).trim()
  return str === '' ? null : str
}

export function nNum(n: unknown): number | null {
  if (n === undefined || n === null || n === '') return null
  const num = Number(n)
  return Number.isFinite(num) ? num : null
}

// Structured postal address for the `address` field type. Trims each part; returns
// null when every part is empty (so an absent address stays clean, not `{}`).
// A plain string-map (index signature) so it is assignable to the Json data value.
export type AddressValue = Record<string, string>
export function nAddress(parts: {
  logradouro?: unknown
  numero?: unknown
  complemento?: unknown
  bairro?: unknown
  cep?: unknown
  municipio?: unknown
  uf?: unknown
  pais?: unknown
}): AddressValue | null {
  const out: AddressValue = {}
  for (const key of ['logradouro', 'numero', 'complemento', 'bairro', 'cep', 'municipio', 'uf', 'pais'] as const) {
    const v = nStr(parts[key])
    if (v !== null) out[key] = v
  }
  return Object.keys(out).length ? out : null
}
