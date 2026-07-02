import { randomUUID } from 'node:crypto'
import { Database } from '@/platform/db/client'
import { verifications } from '@/platform/db/schema'
import { VerificationStore, IssueResetTokenInput } from '@/contexts/identity/application/ports/out/VerificationStore'

// Driven adapter over the better-auth `verifications` table. Mints the bare token
// and stores it under the `reset-password:<token>` identifier with `value` set to
// the user id, exactly as the source invite flow does, so better-auth's
// /reset-password endpoint consumes it when the invitee first sets a password.
export class DrizzleVerificationStore implements VerificationStore {
  constructor(private readonly db: Database) {}

  async issueResetToken(input: IssueResetTokenInput): Promise<{ token: string }> {
    const token = randomUUID()
    await this.db.insert(verifications).values({
      id: randomUUID(),
      identifier: `reset-password:${token}`,
      value: input.userId,
      expiresAt: input.expiresAt,
    })
    return { token }
  }
}
