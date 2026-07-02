import { Result } from '@/shared/kernel/Result'

// Driving ports behind emails.mailAccounts.addMember / removeMember. Only the
// account owner may manage members, and only shared accounts accept them.

export interface AddMemberCommand {
  actorId: string
  accountId: string
  userId: string
  canSend: boolean
}

export interface AddMember {
  execute(cmd: AddMemberCommand): Promise<Result<{ success: true }>>
}

export interface RemoveMemberCommand {
  actorId: string
  accountId: string
  userId: string
}

export interface RemoveMember {
  execute(cmd: RemoveMemberCommand): Promise<Result<{ success: true }>>
}
