import { forms } from '@/platform/db/schema'
import { FormView } from '@/contexts/forms/application/queries/ListForms'
import { FormField } from '@/contexts/forms/domain/FormField'
import { FormSettings } from '@/contexts/forms/domain/FormSettings'

type FormsRow = typeof forms.$inferSelect

// Read-side row -> view shaping shared by the ListForms and GetForm adapters
// (CQRS): straight projection, no domain objects.
export function toFormView(row: FormsRow): FormView {
  return {
    id: row.id,
    entityId: row.entityId,
    name: row.name,
    description: row.description,
    fields: JSON.parse(row.fields) as FormField[],
    settings: JSON.parse(row.settings) as FormSettings,
    publicToken: row.publicToken,
    isPublic: row.isPublic === 1,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
