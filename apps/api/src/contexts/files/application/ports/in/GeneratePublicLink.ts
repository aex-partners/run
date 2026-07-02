import { Result } from '@/shared/kernel/Result'

// Maps to the source `files.share.togglePublic` procedure: enabling mints a
// public token, disabling clears it.
export interface GeneratePublicLinkCommand {
  id: string
  enabled: boolean
}

export interface GeneratePublicLink {
  execute(cmd: GeneratePublicLinkCommand): Promise<Result<{ publicToken: string | null }>>
}
