import { Json } from '@/shared/domain/Json'
import { Result } from '@/shared/kernel/Result'

export interface StartFlowCommand {
  flowId: string
  input: Json
}

export interface StartFlow {
  execute(cmd: StartFlowCommand): Promise<Result<{ runId: string; status: string; output: Json }>>
}
