import { Result } from '@/shared/kernel/Result'
import { Label } from '@/contexts/email/domain/Label'

// Driving port behind emails.labelToggle. Adds/removes a named label tag on an
// email, copying the colour from the account's label definition.
export interface ToggleLabelCommand {
  actorId: string
  id: string
  labelName: string
}

export interface ToggleLabel {
  execute(cmd: ToggleLabelCommand): Promise<Result<{ labels: Label[] }>>
}
