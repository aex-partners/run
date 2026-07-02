import { FileAccess } from '@/contexts/files/domain/FileShare'

// Read side (CQRS). Backs `files.share.getData`: the public link plus the list of
// users the file is shared with (joined against the user directory for display).
export interface SharedUser {
  id: string
  name: string
  email: string
  access: FileAccess
}

export interface ShareData {
  publicLink: string | null
  publicEnabled: boolean
  sharedWith: SharedUser[]
}

export interface GetShareData {
  execute(input: { id: string }): Promise<ShareData>
}
