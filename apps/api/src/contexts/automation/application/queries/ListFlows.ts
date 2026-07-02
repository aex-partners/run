// `flows.list`: every flow with its latest version's displayName attached.
export interface FlowListItem {
  id: string
  status: 'enabled' | 'disabled'
  folderId: string | null
  publishedVersionId: string | null
  displayName: string
  createdAt: Date
  updatedAt: Date
}

export interface ListFlows {
  execute(): Promise<FlowListItem[]>
}
