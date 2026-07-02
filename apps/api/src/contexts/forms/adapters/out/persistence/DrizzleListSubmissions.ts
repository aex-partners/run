import { eq, desc } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { formSubmissions } from '@/platform/db/schema'
import { JsonObject } from '@/shared/domain/Json'
import {
  ListSubmissions,
  ListSubmissionsOptions,
  SubmissionView,
} from '@/contexts/forms/application/queries/ListSubmissions'

// Read-side adapter (CQRS). AEX `listSubmissions`.
export class DrizzleListSubmissions implements ListSubmissions {
  constructor(private readonly db: Database) {}

  async execute(opts: ListSubmissionsOptions): Promise<SubmissionView[]> {
    const rows = await this.db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, opts.formId))
      .orderBy(desc(formSubmissions.createdAt))

    return rows.map((r) => ({
      id: r.id,
      formId: r.formId,
      entityRecordId: r.entityRecordId,
      data: JSON.parse(r.data) as JsonObject,
      submitterIp: r.submitterIp,
      createdAt: r.createdAt,
    }))
  }
}
