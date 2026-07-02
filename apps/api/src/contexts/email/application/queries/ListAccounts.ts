// Read side (CQRS). Backs emails.mailAccounts.list: the accounts the user can
// access, shaped for the account picker (isOwner derived from ownerId).
export interface AccountListItem {
  id: string
  displayName: string
  emailAddress: string
  fromName: string | null
  isShared: boolean
  isOwner: boolean
}

export interface ListAccounts {
  execute(input: { userId: string }): Promise<AccountListItem[]>
}
