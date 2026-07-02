import { FormField } from '@/contexts/forms/domain/FormField'
import { FormSettings } from '@/contexts/forms/domain/FormSettings'
import { EntityFieldOption } from '@/contexts/forms/domain/EntityFieldSpec'

// Public-facing render model: the form's own config plus the entity's field
// definitions needed to render inputs. AEX `getPublicForm`.
export interface PublicEntityField {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  options?: EntityFieldOption[]
}

export interface PublicFormView {
  id: string
  name: string
  description: string | null
  fields: FormField[]
  settings: FormSettings
  entityFields: PublicEntityField[]
}

export interface GetPublicFormOptions {
  token: string
}

export interface GetPublicForm {
  execute(opts: GetPublicFormOptions): Promise<PublicFormView | null>
}
