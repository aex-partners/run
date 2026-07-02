// Read model (CQRS). The shape agents.list / agents.getById return: the full
// agent row with skillIds/toolIds already parsed into string arrays (the source
// returned them as raw JSON strings). Read adapters project rows straight into
// this view without touching the domain.
export interface AgentView {
  id: string
  name: string
  slug: string
  description: string | null
  avatar: string | null
  systemPrompt: string
  modelId: string | null
  skillIds: string[]
  toolIds: string[]
  isSystem: boolean
  userId: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}
