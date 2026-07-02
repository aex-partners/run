import { Json } from '@/shared/domain/Json'

// A flow step. `input`/`output` may contain template strings like
// "{{trigger.email}}" or "{{step1.total}}", resolved purely at decide time.
//   piece    -> calls an integration (impure -> goes through PieceGateway port)
//   code     -> runs user JS (impure -> goes through CodeSandbox port)
//   router   -> a PURE branch decision, no IO
//   complete -> terminal, yields the flow output
export type Step =
  | { id: string; type: 'piece'; pieceId: string; action: string; input: Json; next: string | null }
  | { id: string; type: 'code'; code: string; input: Json; next: string | null }
  | { id: string; type: 'router'; branches: RouterBranch[]; otherwise: string | null }
  | { id: string; type: 'complete'; output: Json }

export interface RouterBranch {
  whenVar: string // a variable path, e.g. "step1.status"
  equals: Json
  goto: string
}
