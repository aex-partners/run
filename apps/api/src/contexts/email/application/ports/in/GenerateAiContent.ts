import { Result } from '@/shared/kernel/Result'

// Driving ports behind emails.aiEnabled / aiSummary / aiDraft. The actual LLM
// work is delegated to the AiDrafter ACL; these gate on the feature flag and
// persist the result back onto the email.

export interface CheckAiEnabled {
  execute(): Promise<Result<{ enabled: boolean }>>
}

export interface GenerateAiSummaryCommand {
  actorId: string
  id: string
}

export interface GenerateAiSummary {
  execute(cmd: GenerateAiSummaryCommand): Promise<Result<{ summary: string }>>
}

export interface GenerateAiDraftCommand {
  actorId: string
  id: string
  prompt?: string
}

export interface GenerateAiDraft {
  execute(cmd: GenerateAiDraftCommand): Promise<Result<{ draft: string }>>
}
