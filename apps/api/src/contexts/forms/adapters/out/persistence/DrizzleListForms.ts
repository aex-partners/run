import { eq, desc } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { forms } from '@/platform/db/schema'
import { ListForms, ListFormsOptions, FormView } from '@/contexts/forms/application/queries/ListForms'
import { toFormView } from '@/contexts/forms/adapters/out/persistence/formReadMapping'

// Read-side adapter (CQRS). AEX `listByEntity`.
export class DrizzleListForms implements ListForms {
  constructor(private readonly db: Database) {}

  async execute(opts: ListFormsOptions): Promise<FormView[]> {
    const rows = await this.db
      .select()
      .from(forms)
      .where(eq(forms.entityId, opts.entityId))
      .orderBy(desc(forms.createdAt))
    return rows.map(toFormView)
  }
}
