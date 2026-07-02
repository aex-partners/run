import { randomUUID } from 'node:crypto'
import { Result, ok } from '@/shared/kernel/Result'
import { Database } from '@/platform/db/client'
import { users } from '@/platform/db/schema'
import {
  ProvisionBotUser,
  ProvisionBotUserInput,
} from '@/contexts/identity/application/ports/in/ProvisionBotUser'

// Driving adapter implementing ProvisionBotUser over identity's OWN users table.
// Inserts a kind='bot' user. This keeps bot provisioning inside the identity
// context (the agents context bridges to it via main instead of writing users).
export class DrizzleProvisionBotUser implements ProvisionBotUser {
  constructor(private readonly db: Database) {}

  async execute(input: ProvisionBotUserInput): Promise<Result<{ userId: string }>> {
    const userId = randomUUID()
    await this.db.insert(users).values({
      id: userId,
      name: input.name,
      email: input.email,
      emailVerified: true,
      image: input.image,
      role: 'user',
      kind: 'bot',
    })
    return ok({ userId })
  }
}
