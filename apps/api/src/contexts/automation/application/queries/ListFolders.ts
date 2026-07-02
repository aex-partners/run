// `flows.listFolders`: folders ordered by displayOrder.
export interface FolderView {
  id: string
  displayName: string
  displayOrder: number
  createdAt: Date
}

export interface ListFolders {
  execute(): Promise<FolderView[]>
}
