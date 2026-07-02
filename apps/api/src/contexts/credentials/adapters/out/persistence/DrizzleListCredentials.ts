import { and, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { credentials } from '@/platform/db/schema'
import {
  ListCredentials,
  ListCredentialsQuery,
  CredentialView,
} from '@/contexts/credentials/application/ports/in/ListCredentials'

// Driven read-side adapter (CQRS). Answers the ListCredentials query with a
// direct SQL query — no aggregate, no decryption. The secret `value` is never
// returned; only `hasValue` (value !== '{}') leaves the boundary, mirroring the
// source router's list masking.
export class DrizzleListCredentials implements ListCredentials {
  constructor(private readonly db: Database) {}

  async execute(query: ListCredentialsQuery): Promise<CredentialView[]> {
    const rows = await this.db
      .select()
      .from(credentials)
      .where(
        and(
          eq(credentials.createdBy, query.userId),
          query.pluginName ? eq(credentials.pluginName, query.pluginName) : undefined,
        ),
      )

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      pluginName: r.pluginName,
      type: r.type,
      status: r.status,
      isPrimary: r.isPrimary,
      hasValue: r.value !== '{}',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  }
}
