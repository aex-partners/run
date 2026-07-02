import { Result } from '@/shared/kernel/Result'
import { FormField } from '@/contexts/forms/domain/FormField'
import { FormSettings } from '@/contexts/forms/domain/FormSettings'

export interface UpdateFormCommand {
  id: string
  name?: string
  description?: string
  fields?: FormField[]
  settings?: FormSettings
}

export interface UpdateForm {
  execute(cmd: UpdateFormCommand): Promise<Result<{ id: string }>>
}
