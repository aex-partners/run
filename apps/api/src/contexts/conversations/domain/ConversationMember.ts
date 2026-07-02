// Entity inside the Conversation aggregate. Tracks one user's membership of a
// conversation plus their PER-MEMBER state: read cursor and the pinned/favorite/
// muted flags (each personal — pinning a conversation only affects the pinner).
// Identity is the (conversationId, userId) pair; here we carry just userId since
// it always lives under a known conversation.
export interface ConversationMemberState {
  userId: string
  joinedAt: Date
  lastReadAt: Date
  pinned: boolean
  favorite: boolean
  muted: boolean
}

export class ConversationMember {
  private constructor(private state: ConversationMemberState) {}

  // A freshly joined member: read cursor at join time, all flags off.
  static create(userId: string, now: Date): ConversationMember {
    return new ConversationMember({
      userId,
      joinedAt: now,
      lastReadAt: now,
      pinned: false,
      favorite: false,
      muted: false,
    })
  }

  static rehydrate(state: ConversationMemberState): ConversationMember {
    return new ConversationMember({ ...state })
  }

  get userId(): string {
    return this.state.userId
  }

  get joinedAt(): Date {
    return this.state.joinedAt
  }

  get lastReadAt(): Date {
    return this.state.lastReadAt
  }

  get pinned(): boolean {
    return this.state.pinned
  }

  get favorite(): boolean {
    return this.state.favorite
  }

  get muted(): boolean {
    return this.state.muted
  }

  // PURE: advance the read cursor.
  markRead(now: Date): void {
    this.state.lastReadAt = now
  }

  // PURE toggles. Each returns the NEW flag value (the router echoes it back).
  togglePinned(): boolean {
    this.state.pinned = !this.state.pinned
    return this.state.pinned
  }

  toggleFavorite(): boolean {
    this.state.favorite = !this.state.favorite
    return this.state.favorite
  }

  toggleMuted(): boolean {
    this.state.muted = !this.state.muted
    return this.state.muted
  }
}
