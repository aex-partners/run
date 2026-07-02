// Read side (CQRS). Backs emails.labels.list: the label definitions for one
// account the user can access (empty when the account is not theirs).
export interface LabelListItem {
  id: string
  accountId: string
  name: string
  color: string
  createdAt: Date
}

export interface ListLabels {
  execute(input: { userId: string; accountId: string }): Promise<LabelListItem[]>
}
