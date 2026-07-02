import { Result } from '@/shared/kernel/Result'

// `flows.restoreVersion`: clone a locked version into a fresh draft (replacing any
// existing draft).
export interface RestoreVersionCommand {
  flowId: string
  versionId: string
}

export interface RestoreVersion {
  execute(cmd: RestoreVersionCommand): Promise<Result<{ versionId: string }>>
}
