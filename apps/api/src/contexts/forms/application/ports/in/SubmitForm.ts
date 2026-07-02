import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'

// Public submission of a form by its token (AEX `submitPublicForm`).
export interface SubmitFormCommand {
  token: string
  data: JsonObject
  submitterIp?: string | null
}

export interface SubmitForm {
  execute(cmd: SubmitFormCommand): Promise<Result<{ id: string }>>
}
