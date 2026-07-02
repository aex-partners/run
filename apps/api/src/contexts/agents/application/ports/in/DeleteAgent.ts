import { Result } from '@/shared/kernel/Result'

// Driving port. Mirrors agents.delete — rejected for system agents, idempotent
// otherwise.
export interface DeleteAgentCommand {
  id: string
}

export interface DeleteAgent {
  execute(cmd: DeleteAgentCommand): Promise<Result<{ success: true }>>
}
