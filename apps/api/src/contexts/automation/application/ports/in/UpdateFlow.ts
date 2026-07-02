import { Result } from '@/shared/kernel/Result'

// `flows.update`: change status and/or folder. A status change drives the trigger
// lifecycle (enable/disable) against the published version.
export interface UpdateFlowCommand {
  id: string
  status?: 'enabled' | 'disabled'
  folderId?: string | null
}

export interface UpdateFlow {
  execute(cmd: UpdateFlowCommand): Promise<Result<{ success: true }>>
}
