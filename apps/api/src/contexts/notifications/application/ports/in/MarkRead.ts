import { Result } from '@/shared/kernel/Result'

// Driving port. Marks one notification read. Scoped to its owner: a non-owned or
// missing id is a silent no-op (mirrors AEX's `UPDATE ... WHERE id AND userId`).
export interface MarkReadCommand {
  userId: string
  id: string
}

export interface MarkRead {
  execute(cmd: MarkReadCommand): Promise<Result<{ success: true }>>
}
