import { Database } from '@/platform/db/client'
import { IsConfigured } from '@/contexts/email/application/queries/IsConfigured'
import { accessibleAccountIds } from '@/contexts/email/adapters/out/persistence/accountScope'

// Read-side adapter. Backs emails.isConfigured.
export class DrizzleIsConfigured implements IsConfigured {
  constructor(private readonly db: Database) {}

  async execute(input: { userId: string }): Promise<{ configured: boolean }> {
    const ids = await accessibleAccountIds(this.db, input.userId)
    return { configured: ids.length > 0 }
  }
}
