// ACL out-port to the notifications/email context. Sends the "you've been
// invited" email carrying the set-password link. The adapter (wired in main)
// owns the URL shape (CORS_ORIGIN + token) and the template rendering. Returns
// whether the mail was actually dispatched (fail-soft). Interface only.
export interface SendInviteInput {
  to: string
  name: string
  inviterName: string
  token: string
}

export interface InviteNotifier {
  sendInvite(input: SendInviteInput): Promise<{ sent: boolean }>
}
