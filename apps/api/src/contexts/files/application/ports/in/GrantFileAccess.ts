import { FileAccess } from '@/contexts/files/domain/FileShare'

// Driving port for the conversations context's attachment ACL: grant a set of
// chat members (userIds) access to a set of attachments (fileIds). Lets
// conversations reuse the files share machinery instead of writing files' tables
// directly. `access` defaults to 'viewer' when omitted.
export interface GrantFileAccessInput {
  fileIds: string[]
  userIds: string[]
  access?: FileAccess
}

export interface GrantFileAccess {
  execute(input: GrantFileAccessInput): Promise<void>
}
