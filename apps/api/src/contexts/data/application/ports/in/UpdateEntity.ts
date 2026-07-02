import { Result } from '@/shared/kernel/Result'

// Covers entities.renameEntity + entities.updateDescription: either or both may
// be supplied. A rename re-derives the slug in the aggregate.
export interface UpdateEntityCommand {
  entityId: string
  name?: string
  description?: string
}

export interface UpdateEntity {
  execute(cmd: UpdateEntityCommand): Promise<Result<{ ok: true }>>
}
