import { Result } from '@/shared/kernel/Result'

// `flows.create`: create a disabled flow plus an initial empty-trigger draft.
export interface CreateFlowCommand {
  displayName: string
  createdBy: string | null
}

export interface CreateFlow {
  execute(cmd: CreateFlowCommand): Promise<Result<{ id: string; versionId: string }>>
}
