// The small set of Bling ERP resources Eric can read. Each maps to a REST path in
// the adapter (produtos -> /produtos, pedidos -> /pedidos/vendas, contatos ->
// /contatos). PURE data: no I/O.
export type BlingResource = 'produtos' | 'pedidos' | 'contatos'

const RESOURCES: ReadonlySet<BlingResource> = new Set<BlingResource>([
  'produtos',
  'pedidos',
  'contatos',
])

// Narrow an untrusted string onto the resource union. Returns null when it is not
// a known resource. Total, PURE.
export const toBlingResource = (value: unknown): BlingResource | null =>
  typeof value === 'string' && RESOURCES.has(value as BlingResource)
    ? (value as BlingResource)
    : null
