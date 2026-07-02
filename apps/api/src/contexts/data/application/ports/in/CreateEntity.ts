import { Result } from '@/shared/kernel/Result'
import { FieldDefinitionInput } from '@/contexts/data/application/ports/in/FieldDefinitionInput'

// Driving port. Plain-data command in, plain-data out — no domain object crosses
// the boundary. `createdBy` is injected by the driving adapter from the session
// (optional so the in-memory/demo path can omit it). Optional initial `fields`
// mirror entities.createEntity's field array.
export interface CreateEntityCommand {
  name: string
  description?: string
  createdBy?: string
  fields?: FieldDefinitionInput[]
}

export interface CreateEntity {
  execute(cmd: CreateEntityCommand): Promise<Result<{ id: string; slug: string }>>
}
