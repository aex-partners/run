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
