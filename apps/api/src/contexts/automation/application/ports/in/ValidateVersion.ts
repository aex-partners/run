import { FlowValidationResult } from '@/contexts/automation/domain/FlowValidator'

// In-port: validate a (draft) flow trigger graph on demand and return the
// structured errors/warnings so the builder can surface them inline — distinct
// from SaveVersion (which discards issues) and PublishVersion (which only
// exposes them on failure).
export interface ValidateVersionCommand {
  trigger: string // JSON-stringified FlowTrigger graph
  publish?: boolean // promote publish-only issues (empty trigger) to errors
}

export interface ValidateVersion {
  execute(cmd: ValidateVersionCommand): FlowValidationResult
}
