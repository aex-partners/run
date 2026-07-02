import { Result } from '@/shared/kernel/Result'
import { EmailFolder } from '@/contexts/email/domain/EmailFolder'

// Driving port behind emails.archive / delete / moveToSpam — the three AEX
// procedures that move a set of emails to a target folder (archive / trash /
// spam respectively). One use case, the controller supplies the folder.
export interface MoveEmailsCommand {
  actorId: string
  ids: string[]
  folder: EmailFolder
}

export interface MoveEmails {
  execute(cmd: MoveEmailsCommand): Promise<Result<{ success: true }>>
}
