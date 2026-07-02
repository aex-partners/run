import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'

// Driven port. The application states WHAT it needs from persistence; an adapter
// under adapters/out implements HOW (Drizzle JSONB, in-memory, etc.).
export interface EntityRepository {
  nextId(): EntityId
  findById(id: EntityId): Promise<EntityDefinition | null>
  // Resolve by slug, name, or id (used by the AI tools' entity ref resolution).
  findByRef(ref: string): Promise<EntityDefinition | null>
  save(entity: EntityDefinition): Promise<void>
  delete(id: EntityId): Promise<void>
}
