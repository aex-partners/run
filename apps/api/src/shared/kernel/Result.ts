// Result<T, E>: explicit success/failure without throwing.
// Domain rule violations return a failure; only truly exceptional faults throw.
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export const ok = <T, E = string>(value: T): Result<T, E> => ({ ok: true, value })
export const fail = <T = never, E = string>(error: E): Result<T, E> => ({ ok: false, error })

export const isOk = <T, E>(r: Result<T, E>): r is { ok: true; value: T } => r.ok
export const isFail = <T, E>(r: Result<T, E>): r is { ok: false; error: E } => !r.ok
