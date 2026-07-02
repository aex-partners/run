/**
 * Persistencia de views/filtros salvos. Sandbox usa localStorage; no produto
 * vira server (tRPC) com escopo real por usuario. `scope` = 'private' (so o
 * dono ve) ou 'general' (todos veem). Aqui simulamos os dois buckets.
 */
export type Scope = 'private' | 'public' | 'shared'
export interface Saved<T> {
  id: string
  name: string
  /** private = só o dono; public = todos; shared = usuarios escolhidos. */
  scope: Scope
  /** ids dos usuarios com quem foi compartilhado (scope = 'shared'). */
  sharedWith?: string[]
  payload: T
}

export const VIEWS_KEY = 'lab.savedViews'
export const FILTERS_KEY = 'lab.savedFilters'
/** view padrão do usuário POR TIPO de view: { [viewKey]: viewId }. */
export const DEFAULT_VIEWS_KEY = 'lab.defaultViews'

export function loadSaved<T>(key: string): Saved<T>[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Saved<T>[]) : []
  } catch {
    return []
  }
}
function persist<T>(key: string, list: Saved<T>[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    /* quota/sandbox: ignora */
  }
}
export function addSaved<T>(key: string, item: Saved<T>): Saved<T>[] {
  const list = [...loadSaved<T>(key), item]
  persist(key, list)
  return list
}
export function removeSaved<T>(key: string, id: string): Saved<T>[] {
  const list = loadSaved<T>(key).filter((s) => s.id !== id)
  persist(key, list)
  return list
}
export function updateSaved<T>(key: string, id: string, patch: Partial<Saved<T>>): Saved<T>[] {
  const list = loadSaved<T>(key).map((s) => (s.id === id ? { ...s, ...patch } : s))
  persist(key, list)
  return list
}

// ---- view padrão por tipo de view (auto-aplica ao entrar) ----
function loadDefaultViews(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DEFAULT_VIEWS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}
/** id da view padrão do usuário p/ esse tipo de view (null = a "View Padrão" pristine). */
export function getDefaultView(viewKey?: string): string | null {
  if (!viewKey) return null
  return loadDefaultViews()[viewKey] ?? null
}
/** define (ou limpa, com id=null) a view padrão do usuário p/ esse tipo de view. */
export function saveDefaultView(viewKey: string | undefined, id: string | null): void {
  if (!viewKey) return
  const m = loadDefaultViews()
  if (id) m[viewKey] = id
  else delete m[viewKey]
  try {
    localStorage.setItem(DEFAULT_VIEWS_KEY, JSON.stringify(m))
  } catch {
    /* quota/sandbox: ignora */
  }
}

/**
 * Igualdade estrutural (independente de ordem de chaves). Usada p/ detectar se a
 * view atual divergiu do snapshot salvo (dirty) , `filter` e `columnSizing` têm
 * chaves dinâmicas, então JSON.stringify não serve.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  const aArr = Array.isArray(a)
  const bArr = Array.isArray(b)
  if (aArr !== bArr) return false
  if (aArr && bArr) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false
    return true
  }
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const ak = Object.keys(ao)
  const bk = Object.keys(bo)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false
    if (!deepEqual(ao[k], bo[k])) return false
  }
  return true
}
