import { Result } from '@/shared/kernel/Result'

// Driving port. `createdBy` is injected by the HTTP adapter from the session.
export interface CreateFormCommand {
  entityId: string
  name: string
  createdBy: string
}

export interface CreateForm {
  execute(cmd: CreateFormCommand): Promise<Result<{ id: string; name: string }>>
}
