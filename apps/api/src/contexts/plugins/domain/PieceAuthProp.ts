// One field of a LOCAL piece's auth schema, declared in the bundled catalog under
// `auth.props[]`. Projected verbatim to the frontend so the Connect dialog can
// render a dynamic form: the entered values are keyed by `name` and stored as the
// credential bag the tools resolve (e.g. Sicredi reads `chaveAcesso`, PagSeguro
// `token`, NF-e `pfx`+`password`). PURE data: no I/O.
export type PieceAuthPropType = 'text' | 'secret' | 'file' | 'select'

export interface PieceAuthPropOption {
  label: string
  value: string
}

export interface PieceAuthProp {
  name: string
  displayName: string
  type: PieceAuthPropType
  required: boolean
  // Only meaningful for `type: 'select'`.
  options?: PieceAuthPropOption[]
}

const PROP_TYPES = new Set<PieceAuthPropType>(['text', 'secret', 'file', 'select'])

// Narrow an untrusted catalog prop `type` onto the domain union, defaulting to
// 'text' (a plain input) when it is missing or unrecognised. PURE, total.
export const toPieceAuthPropType = (type: unknown): PieceAuthPropType =>
  typeof type === 'string' && PROP_TYPES.has(type as PieceAuthPropType) ? (type as PieceAuthPropType) : 'text'
