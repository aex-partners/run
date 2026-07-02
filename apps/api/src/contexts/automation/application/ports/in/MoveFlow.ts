import { Result } from '@/shared/kernel/Result'

// `flows.moveFlow`: move a flow into a folder (or to the root with null).
export interface MoveFlowCommand {
  flowId: string
  folderId: string | null
}

export interface MoveFlow {
  execute(cmd: MoveFlowCommand): Promise<Result<{ success: true }>>
}
