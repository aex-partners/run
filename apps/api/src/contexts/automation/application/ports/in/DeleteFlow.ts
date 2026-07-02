import { Result } from '@/shared/kernel/Result'

// `flows.delete`: remove a flow (cascades versions/runs in the schema).
export interface DeleteFlowCommand {
  id: string
}

export interface DeleteFlow {
  execute(cmd: DeleteFlowCommand): Promise<Result<{ success: true }>>
}
