// `flows.getById`: a flow plus all its versions (newest first).
export interface FlowVersionView {
  id: string
  flowId: string
  displayName: string
  trigger: string
  state: 'draft' | 'locked'
  valid: boolean
  schemaVersion: string | null
  createdAt: Date
  updatedAt: Date
}

export interface FlowDetailView {
  id: string
  status: 'enabled' | 'disabled'
  folderId: string | null
  publishedVersionId: string | null
  createdAt: Date
  updatedAt: Date
  versions: FlowVersionView[]
}

export interface GetFlow {
  execute(q: { id: string }): Promise<FlowDetailView | null>
}
