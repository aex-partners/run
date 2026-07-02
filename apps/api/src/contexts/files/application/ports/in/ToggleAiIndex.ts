import { Result } from '@/shared/kernel/Result'

export interface ToggleAiIndexCommand {
  id: string
  enabled: boolean
}

export interface ToggleAiIndex {
  execute(cmd: ToggleAiIndexCommand): Promise<Result<{ aiIndexed: boolean }>>
}
