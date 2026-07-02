import { Form } from '@/contexts/forms/domain/Form'
import { FormId } from '@/contexts/forms/domain/FormId'
import { EntityRef } from '@/contexts/forms/domain/EntityRef'
import { FormField } from '@/contexts/forms/domain/FormField'
import { FormSettings } from '@/contexts/forms/domain/FormSettings'

// Persistence row in parsed form: `fields`/`settings` are already deserialized
// objects (the Drizzle adapter handles the JSON text <-> object round-trip) and
// `isPublic` is a boolean (the adapter maps the 0/1 integer column). The mapper
// is the only place that knows the persisted shape.
export interface FormRow {
  id: string
  entityId: string
  name: string
  description: string | null
  fields: FormField[]
  settings: FormSettings
  publicToken: string | null
  isPublic: boolean
  createdBy: string
}

export const FormMapper = {
  toPersistence(form: Form): FormRow {
    return {
      id: form.id.value,
      entityId: form.entityId.value,
      name: form.name,
      description: form.description,
      fields: [...form.fields()],
      settings: form.settings(),
      publicToken: form.publicToken,
      isPublic: form.isPublic,
      createdBy: form.createdBy,
    }
  },

  toDomain(row: FormRow): Form {
    return Form.rehydrate(
      FormId.of(row.id),
      EntityRef.of(row.entityId),
      row.name,
      row.description,
      row.fields,
      row.settings,
      row.publicToken,
      row.isPublic,
      row.createdBy,
    )
  },
}
