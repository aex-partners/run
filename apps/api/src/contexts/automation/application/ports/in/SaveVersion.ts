import { Result } from '@/shared/kernel/Result'

// `flows.saveVersion`: upsert the editable draft. The trigger is a JSON-stringified
// FlowTrigger; validity is computed in save mode (incomplete drafts are allowed).
export interface SaveVersionCommand {
  flowId: string
  displayName: string
  trigger: string
}

export interface SaveVersion {
  execute(cmd: SaveVersionCommand): Promise<Result<{ versionId: string }>>
}
