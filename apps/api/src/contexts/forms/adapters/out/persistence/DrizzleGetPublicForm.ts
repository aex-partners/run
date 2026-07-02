import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { forms } from '@/platform/db/schema'
import {
  GetPublicForm,
  GetPublicFormOptions,
  PublicFormView,
  PublicEntityField,
} from '@/contexts/forms/application/queries/GetPublicForm'
import { EntityCatalog } from '@/contexts/forms/application/ports/out/EntityCatalog'
import { FormField } from '@/contexts/forms/domain/FormField'
import { FormSettings } from '@/contexts/forms/domain/FormSettings'

// Read-side adapter (CQRS). AEX `getPublicForm`. The form itself lives in forms'
// own `forms` table; the entity's field definitions belong to the `data` context
// and are read through the EntityCatalog ACL out-port (bridged in main to
// data.DescribeEntity) instead of touching the `entities` table directly, exactly
// like the write side (CreateForm/SubmitForm).
export class DrizzleGetPublicForm implements GetPublicForm {
  constructor(
    private readonly db: Database,
    private readonly catalog: EntityCatalog,
  ) {}

  async execute(opts: GetPublicFormOptions): Promise<PublicFormView | null> {
    const formRows = await this.db
      .select()
      .from(forms)
      .where(eq(forms.publicToken, opts.token))
      .limit(1)
    const form = formRows[0]
    if (!form || form.isPublic !== 1) return null

    const entityFields = await this.catalog.fieldsOf(form.entityId)
    if (!entityFields) return null

    return {
      id: form.id,
      name: form.name,
      description: form.description,
      fields: JSON.parse(form.fields) as FormField[],
      settings: JSON.parse(form.settings) as FormSettings,
      entityFields: entityFields.map(
        (f): PublicEntityField => ({
          id: f.id,
          name: f.name,
          slug: f.slug,
          type: f.type,
          required: f.required,
          options: f.options,
        }),
      ),
    }
  }
}
