import { Agent, AgentSnapshot } from '@/contexts/agents/domain/Agent'
import { AgentView } from '@/contexts/agents/application/queries/AgentView'

// Persistence row for the `agents` table. skillIds/toolIds are stored as JSON
// strings (text columns), exactly as in AEX. The mapper is the only place that
// knows this on-disk shape.
export interface AgentRow {
  id: string
  name: string
  slug: string
  description: string | null
  avatar: string | null
  systemPrompt: string
  modelId: string | null
  skillIds: string
  toolIds: string
  isSystem: boolean
  userId: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

// Tolerant parse of a JSON string-array column: never throws, keeps only strings.
export const parseIdList = (raw: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export const AgentMapper = {
  toPersistence(agent: Agent): AgentRow {
    return {
      id: agent.id.value,
      name: agent.name,
      slug: agent.slug.value,
      description: agent.description,
      avatar: agent.avatar,
      systemPrompt: agent.systemPrompt,
      modelId: agent.modelId,
      skillIds: JSON.stringify([...agent.skillIds]),
      toolIds: JSON.stringify([...agent.toolIds]),
      isSystem: agent.isSystem,
      userId: agent.userId,
      createdBy: agent.createdBy,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    }
  },

  toDomain(row: AgentRow): Agent {
    const snapshot: AgentSnapshot = {
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
    }
    return Agent.rehydrate(snapshot)
  },

  // Projects a freshly written aggregate into the read model returned by
  // create/update (parsed arrays, slug value), matching agents.list/getById.
  toView(agent: Agent): AgentView {
    return {
      id: agent.id.value,
      name: agent.name,
      slug: agent.slug.value,
      description: agent.description,
      avatar: agent.avatar,
      systemPrompt: agent.systemPrompt,
      modelId: agent.modelId,
      skillIds: [...agent.skillIds],
      toolIds: [...agent.toolIds],
      isSystem: agent.isSystem,
      userId: agent.userId,
      createdBy: agent.createdBy,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    }
  },
}
