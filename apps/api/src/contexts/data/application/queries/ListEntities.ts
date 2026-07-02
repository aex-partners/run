// Read side (CQRS). Lists entities with their record counts — ports
// entities.list (and the AI list_entities tool). Bypasses the domain.
export interface EntityFieldSummary {
  name: string
  slug: string
  type: string
}

export interface EntitySummary {
  id: string
  name: string
  slug: string
  description: string | null
  fields: EntityFieldSummary[]
  recordCount: number
  createdAt: string
  updatedAt: string
}

export interface ListEntities {
  execute(): Promise<EntitySummary[]>
}
