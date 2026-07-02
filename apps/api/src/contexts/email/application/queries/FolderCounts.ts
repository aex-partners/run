// Read side (CQRS). Backs emails.folderCounts: one aggregate query feeding the
// sidebar badges (inbox counts UNREAD only, mirroring AEX).
export interface FolderCountsResult {
  inbox: number
  sent: number
  drafts: number
  spam: number
  trash: number
  starred: number
}

export interface FolderCounts {
  execute(input: { userId: string; accountId?: string }): Promise<FolderCountsResult>
}
