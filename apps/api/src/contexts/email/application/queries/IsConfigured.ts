// Read side (CQRS). Backs emails.isConfigured: does the user have any mail
// account (owned or shared)?
export interface IsConfigured {
  execute(input: { userId: string }): Promise<{ configured: boolean }>
}
