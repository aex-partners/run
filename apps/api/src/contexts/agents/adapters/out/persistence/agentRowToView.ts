import { agents } from '@/platform/db/schema'
import { AgentView } from '@/contexts/agents/application/queries/AgentView'
import { parseIdList } from '@/contexts/agents/application/mappers/AgentMapper'

type AgentRowSelect = typeof agents.$inferSelect

// Read-side projection (CQRS): a raw `agents` row -> AgentView, parsing the
// JSON-string id columns. Shared by the list and get adapters; never touches the
// domain.
export const agentRowToView = (row: AgentRowSelect): AgentView => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description,
  avatar: row.avatar,
  systemPrompt: row.systemPrompt,
  modelId: row.modelId,
  skillIds: parseIdList(row.skillIds),
  toolIds: parseIdList(row.toolIds),
  isSystem: row.isSystem,
  userId: row.userId,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})
