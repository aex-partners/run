// A user is either a real person ("human") or a service/agent account ("bot",
// e.g. the Eric assistant or the Bling connector). Bots are excluded from the
// assignable-users picker. Mirrors the `kind` enum column.
export type UserKind = 'human' | 'bot'

export const isUserKind = (v: string): v is UserKind => v === 'human' || v === 'bot'
