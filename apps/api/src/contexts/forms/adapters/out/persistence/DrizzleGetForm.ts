import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { forms } from '@/platform/db/schema'
import { GetForm, GetFormOptions } from '@/contexts/forms/application/queries/GetForm'
import { FormView } from '@/contexts/forms/application/queries/ListForms'
import { toFormView } from '@/contexts/forms/adapters/out/persistence/formReadMapping'

// Read-side adapter (CQRS). AEX `getById`.
export class DrizzleGetForm implements GetForm {
  constructor(private readonly db: Database) {}

  async execute(opts: GetFormOptions): Promise<FormView | null> {
    const rows = await this.db.select().from(forms).where(eq(forms.id, opts.id)).limit(1)
    const row = rows[0]
    return row ? toFormView(row) : null
  }
}
