import { Json } from '@/shared/domain/Json'

// Effects are DATA: a description of a side effect to perform, produced by the
// pure decider. The imperative shell interprets each one through a driven port.
// Nothing here executes anything.
export type Effect =
  | { kind: 'invokePiece'; stepId: string; pieceId: string; action: string; input: Json; next: string | null }
  | { kind: 'runCode'; stepId: string; code: string; input: Json; next: string | null }
  | { kind: 'route'; from: string; to: string | null }
  | { kind: 'finish'; output: Json }
  | { kind: 'abort'; stepId: string; reason: string }
