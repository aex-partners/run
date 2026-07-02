// VO. The folder an email lives in. Mirrors the AEX `emails.folder` enum and
// drives the mailbox list filter. "starred" is a virtual view (the list query
// filters on the starred flag), but it is part of the stored enum so it stays
// here. An email is in exactly one folder at a time.
export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | 'starred' | 'archive'

export const EMAIL_FOLDERS: readonly EmailFolder[] = [
  'inbox',
  'sent',
  'drafts',
  'spam',
  'trash',
  'starred',
  'archive',
]

export const isEmailFolder = (v: string): v is EmailFolder =>
  (EMAIL_FOLDERS as readonly string[]).includes(v)
