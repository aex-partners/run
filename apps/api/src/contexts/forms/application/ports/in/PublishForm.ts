import { Result } from '@/shared/kernel/Result'

// Toggles a form's public visibility (AEX `togglePublic`).
export interface PublishFormCommand {
  id: string
}

export interface PublishForm {
  execute(cmd: PublishFormCommand): Promise<Result<{ isPublic: boolean; publicToken: string | null }>>
}
