// Driven port over the better-auth `verifications` table. Used by the invite flow
// to mint a reset-password token: better-auth later looks it up under the
// `reset-password:<token>` identifier (with `value` = user id) when the invitee
// first sets their password. The adapter generates the token + row id and
// returns the bare token so the notifier can build the set-password link.
export interface IssueResetTokenInput {
  userId: string
  expiresAt: Date
}

export interface VerificationStore {
  issueResetToken(input: IssueResetTokenInput): Promise<{ token: string }>
}
