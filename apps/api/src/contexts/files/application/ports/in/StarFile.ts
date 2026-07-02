import { Result } from '@/shared/kernel/Result'

export interface StarFileCommand {
  id: string
}

export interface StarFile {
  execute(cmd: StarFileCommand): Promise<Result<{ starred: boolean }>>
}
