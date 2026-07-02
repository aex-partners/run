import { FormField } from '@/contexts/forms/domain/FormField'
import { FormSettings } from '@/contexts/forms/domain/FormSettings'

// Read side (CQRS). Bypasses the domain: an adapter answers with a direct query
// and shapes this view. Used by AEX `listByEntity` and `getById`.
export interface FormView {
  id: string
  entityId: string
  name: string
  description: string | null
  fields: FormField[]
  settings: FormSettings
  publicToken: string | null
  isPublic: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface ListFormsOptions {
  entityId: string
}

export interface ListForms {
  execute(opts: ListFormsOptions): Promise<FormView[]>
}
