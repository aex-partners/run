// VO. A single emoji reaction by one user on a message. The set of reactions on a
// message is a toggle list: reacting again with the same emoji removes it.
export interface Reaction {
  readonly emoji: string
  readonly userId: string
}

// Pure toggle: remove the (emoji,user) pair if present, otherwise add it.
// Returns a NEW array; never mutates the input.
export const toggleReaction = (
  reactions: readonly Reaction[],
  emoji: string,
  userId: string,
): Reaction[] => {
  const idx = reactions.findIndex((r) => r.emoji === emoji && r.userId === userId)
  if (idx >= 0) return reactions.filter((_, i) => i !== idx)
  return [...reactions, { emoji, userId }]
}
