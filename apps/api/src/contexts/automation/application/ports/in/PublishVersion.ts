import { Result } from '@/shared/kernel/Result'
import { ValidationIssue } from '@/contexts/automation/domain/FlowValidator'

// `flows.publish`: validate in publish mode, lock the version, set it as the
// flow's published version. Fails with the structured validation issues when the
// flow is not publishable.
export interface PublishVersionCommand {
  flowId: string
  versionId: string
}

export interface PublishVersionError {
  message: string
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface PublishVersion {
  execute(cmd: PublishVersionCommand): Promise<Result<{ success: true }, PublishVersionError | string>>
}
