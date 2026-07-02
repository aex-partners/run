import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok } from '@/shared/kernel/Result'
import { EmailId } from '@/contexts/email/domain/ids'
import { EmailFolder } from '@/contexts/email/domain/EmailFolder'
import {
  Label,
  toggleLabel as toggleLabelList,
  withSnooze,
  withoutSnooze,
  resolveSnoozeWake,
} from '@/contexts/email/domain/Label'
import { EmailSent } from '@/contexts/email/domain/events/EmailSent'
import { EmailStarred } from '@/contexts/email/domain/events/EmailStarred'
import { EmailReadChanged } from '@/contexts/email/domain/events/EmailReadChanged'
import { EmailMoved } from '@/contexts/email/domain/events/EmailMoved'
import { EmailSnoozed } from '@/contexts/email/domain/events/EmailSnoozed'
import { EmailUnsnoozed } from '@/contexts/email/domain/events/EmailUnsnoozed'
import { EmailLabelsChanged } from '@/contexts/email/domain/events/EmailLabelsChanged'
import { EmailSummarized } from '@/contexts/email/domain/events/EmailSummarized'
import { EmailDrafted } from '@/contexts/email/domain/events/EmailDrafted'

// Strip HTML tags and clamp to the preview length the AEX list view expects.
const previewFromHtml = (html: string): string => html.replace(/<[^>]+>/g, '').slice(0, 200)

export interface EmailSnapshot {
  accountId: string
  externalId: string
  threadId: string | null
  fromName: string
  fromEmail: string
  to: string[]
  cc: string[]
  subject: string
  preview: string
  bodyHtml: string | null
  bodyText: string | null
  folder: EmailFolder
  read: boolean
  starred: boolean
  hasAttachment: boolean
  labels: Label[]
  aiSummary: string | null
  aiDraft: string | null
  date: Date
  createdAt: Date
}

// A message fetched from IMAP, ready to be stored. The folder + flags are already
// mapped by the IMAP adapter; threadId comes from the ThreadReconstruction rule.
export interface ReceiveEmailProps {
  accountId: string
  externalId: string
  threadId: string | null
  fromName: string
  fromEmail: string
  to: string[]
  cc: string[]
  subject: string
  bodyHtml: string | null
  bodyText: string | null
  folder: EmailFolder
  read: boolean
  starred: boolean
  hasAttachment: boolean
  date: Date
}

export interface SendEmailProps {
  accountId: string
  externalId: string
  threadId: string | null
  fromName: string
  fromEmail: string
  to: string[]
  cc: string[]
  subject: string
  bodyHtml: string
}

// AGGREGATE. A single stored message. It guards the mailbox-state invariants and
// the transitions a user drives from the UI — read/star, folder moves
// (archive/trash/spam), snooze/wake, labelling, AI annotations — while leaving
// the wire format to the IMAP adapter and the row shape to the mapper. Every
// mutation is PURE: it changes in-memory state and records an event; nothing
// here touches IO.
export class Email extends AggregateRoot<EmailId> {
  private constructor(
    id: EmailId,
    public readonly accountId: string,
    private _externalId: string,
    private _threadId: string | null,
    private _fromName: string,
    private _fromEmail: string,
    private _to: string[],
    private _cc: string[],
    private _subject: string,
    private _preview: string,
    private _bodyHtml: string | null,
    private _bodyText: string | null,
    private _folder: EmailFolder,
    private _read: boolean,
    private _starred: boolean,
    private _hasAttachment: boolean,
    private _labels: Label[],
    private _aiSummary: string | null,
    private _aiDraft: string | null,
    private readonly _date: Date,
    private readonly _createdAt: Date,
  ) {
    super(id)
  }

  // A message pulled from IMAP. Records no event: sync stores in bulk and the
  // mailbox-synced fact is published once by the SyncAccount use case.
  static receive(id: EmailId, props: ReceiveEmailProps, now: Date): Email {
    const preview = previewFromHtml(props.bodyText || props.bodyHtml || '')
    return new Email(
      id,
      props.accountId,
      props.externalId,
      props.threadId,
      props.fromName,
      props.fromEmail,
      props.to,
      props.cc,
      props.subject,
      preview,
      props.bodyHtml,
      props.bodyText,
      props.folder,
      props.read,
      props.starred,
      props.hasAttachment,
      [],
      null,
      null,
      props.date,
      now,
    )
  }

  // A message we just sent. Lands read, in the Sent folder, previewed from its
  // own HTML body. Records EmailSent.
  static sent(id: EmailId, props: SendEmailProps, now: Date): Email {
    const email = new Email(
      id,
      props.accountId,
      props.externalId,
      props.threadId,
      props.fromName,
      props.fromEmail,
      props.to,
      props.cc,
      props.subject,
      previewFromHtml(props.bodyHtml),
      props.bodyHtml,
      null,
      'sent',
      true,
      false,
      false,
      [],
      null,
      null,
      now,
      now,
    )
    email.addEvent(new EmailSent(id.value, props.accountId, props.to, props.subject, now))
    return email
  }

  static rehydrate(id: EmailId, s: EmailSnapshot): Email {
    return new Email(
      id,
      s.accountId,
      s.externalId,
      s.threadId,
      s.fromName,
      s.fromEmail,
      s.to,
      s.cc,
      s.subject,
      s.preview,
      s.bodyHtml,
      s.bodyText,
      s.folder,
      s.read,
      s.starred,
      s.hasAttachment,
      s.labels,
      s.aiSummary,
      s.aiDraft,
      s.date,
      s.createdAt,
    )
  }

  toggleStar(now: Date): void {
    this._starred = !this._starred
    this.addEvent(new EmailStarred(this.id.value, this._starred, now))
  }

  setRead(read: boolean, now: Date): void {
    if (this._read === read) return
    this._read = read
    this.addEvent(new EmailReadChanged(this.id.value, read, now))
  }

  // archive / trash / spam all funnel here. starred is a virtual view, never a
  // move target, so callers pass one of the real folders.
  moveTo(folder: EmailFolder, now: Date): void {
    this._folder = folder
    this.addEvent(new EmailMoved(this.id.value, folder, now))
  }

  // Snooze: mark read and stash the wake instant in a private label, hiding the
  // mail until the Scheduler fires. Pure: `until` is derived deterministically
  // from `now` and the option.
  snooze(option: string, now: Date): Result<Date> {
    const wake = resolveSnoozeWake(option, now)
    if (!wake.ok) return wake
    this._read = true
    this._labels = withSnooze(this._labels, wake.value)
    this.addEvent(new EmailSnoozed(this.id.value, wake.value, now))
    return ok(wake.value)
  }

  // Wake from snooze: back to the inbox, unread so the user notices, snooze
  // marker dropped. Mirrors AEX's snooze worker.
  unsnooze(now: Date): void {
    this._labels = withoutSnooze(this._labels)
    this._folder = 'inbox'
    this._read = false
    this.addEvent(new EmailUnsnoozed(this.id.value, now))
  }

  toggleLabel(name: string, color: string, now: Date): void {
    this._labels = toggleLabelList(this._labels, name, color)
    this.addEvent(new EmailLabelsChanged(this.id.value, this._labels.map((l) => l.name), now))
  }

  setAiSummary(summary: string, now: Date): void {
    this._aiSummary = summary
    this.addEvent(new EmailSummarized(this.id.value, now))
  }

  setAiDraft(draft: string, now: Date): void {
    this._aiDraft = draft
    this.addEvent(new EmailDrafted(this.id.value, now))
  }

  // Plain-text view for the AI ports: the stored text body, else HTML stripped
  // of tags. Ported from the AEX aiSummary/aiDraft handlers.
  bodyForAi(): string {
    return this._bodyText || this._bodyHtml?.replace(/<[^>]+>/g, '') || ''
  }

  get externalId(): string {
    return this._externalId
  }
  get threadId(): string | null {
    return this._threadId
  }
  get fromName(): string {
    return this._fromName
  }
  get fromEmail(): string {
    return this._fromEmail
  }
  get to(): string[] {
    return this._to
  }
  get cc(): string[] {
    return this._cc
  }
  get subject(): string {
    return this._subject
  }
  get preview(): string {
    return this._preview
  }
  get bodyHtml(): string | null {
    return this._bodyHtml
  }
  get bodyText(): string | null {
    return this._bodyText
  }
  get folder(): EmailFolder {
    return this._folder
  }
  get read(): boolean {
    return this._read
  }
  get starred(): boolean {
    return this._starred
  }
  get hasAttachment(): boolean {
    return this._hasAttachment
  }
  get labels(): Label[] {
    return this._labels
  }
  get aiSummary(): string | null {
    return this._aiSummary
  }
  get aiDraft(): string | null {
    return this._aiDraft
  }
  get date(): Date {
    return this._date
  }
  get createdAt(): Date {
    return this._createdAt
  }
}
