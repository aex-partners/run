// ACL out-port to the assistant context. The invite flow seeds the new user's
// chat space: a DM between the inviter and the invitee, plus the invitee's
// private "Eric" assistant conversation. Identity never imports the assistant
// context; main bridges this to assistant's in-ports. Interface only.
export interface ConversationGateway {
  ensureDm(inviterId: string, inviteeId: string): Promise<void>
  ensureEric(userId: string): Promise<void>
}
