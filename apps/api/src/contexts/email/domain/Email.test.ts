import { describe, it, expect } from 'vitest'
import { Email, ReceiveEmailProps } from '@/contexts/email/domain/Email'
import { EmailId } from '@/contexts/email/domain/ids'
import { isSnoozeLabel } from '@/contexts/email/domain/Label'

const NOW = new Date('2024-01-01T12:00:00.000Z')

function receiveProps(over: Partial<ReceiveEmailProps> = {}): ReceiveEmailProps {
  return {
    accountId: 'acc-1',
    externalId: 'ext-1',
    threadId: null,
    fromName: 'Alice',
    fromEmail: 'alice@example.com',
    to: ['bob@example.com'],
    cc: [],
    subject: 'Hi',
    bodyHtml: '<p>Hello <b>world</b></p>',
    bodyText: null,
    folder: 'inbox',
    read: false,
    starred: false,
    hasAttachment: false,
    date: NOW,
    ...over,
  }
}

function makeEmail(over: Partial<ReceiveEmailProps> = {}): Email {
  return Email.receive(EmailId.of('e1'), receiveProps(over), NOW)
}

describe('Email.receive', () => {
  it('derives a tag-stripped preview from the body', () => {
    const e = makeEmail({ bodyText: 'Plain text body', bodyHtml: null })
    expect(e.preview).toBe('Plain text body')
  })

  it('strips HTML tags for the preview when there is no text body', () => {
    const e = makeEmail()
    expect(e.preview).toBe('Hello world')
  })

  it('records no event on receive', () => {
    expect(makeEmail().pullEvents()).toHaveLength(0)
  })
})

describe('Email.toggleStar', () => {
  it('flips starred and records EmailStarred', () => {
    const e = makeEmail()
    e.toggleStar(NOW)
    expect(e.starred).toBe(true)
    e.toggleStar(NOW)
    expect(e.starred).toBe(false)
    expect(e.pullEvents().map((ev) => ev.name)).toEqual(['email.EmailStarred', 'email.EmailStarred'])
  })
})

describe('Email.setRead', () => {
  it('records an event when the read state changes', () => {
    const e = makeEmail({ read: false })
    e.setRead(true, NOW)
    expect(e.read).toBe(true)
    expect(e.pullEvents()).toHaveLength(1)
  })

  it('is a no-op (no event) when the read state is unchanged', () => {
    const e = makeEmail({ read: false })
    e.setRead(false, NOW)
    expect(e.read).toBe(false)
    expect(e.pullEvents()).toHaveLength(0)
  })
})

describe('Email.moveTo', () => {
  it('moves to the target folder and records EmailMoved', () => {
    const e = makeEmail()
    e.moveTo('trash', NOW)
    expect(e.folder).toBe('trash')
    const events = e.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0]?.name).toBe('email.EmailMoved')
  })
})

describe('Email.toggleLabel', () => {
  it('adds then removes a named label', () => {
    const e = makeEmail()
    e.toggleLabel('Work', '#fff', NOW)
    expect(e.labels.map((l) => l.name)).toEqual(['Work'])
    e.toggleLabel('Work', '#fff', NOW)
    expect(e.labels).toHaveLength(0)
    expect(e.pullEvents().every((ev) => ev.name === 'email.EmailLabelsChanged')).toBe(true)
  })
})

describe('Email.snooze', () => {
  it('marks read, stashes a snooze marker, and returns the wake instant', () => {
    const e = makeEmail({ read: false })
    const r = e.snooze('1h', NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(e.read).toBe(true)
    expect(e.labels.some(isSnoozeLabel)).toBe(true)
    expect(r.value.getTime()).toBe(NOW.getTime() + 60 * 60 * 1000)
    expect(e.pullEvents().map((ev) => ev.name)).toContain('email.EmailSnoozed')
  })

  it('fails on an invalid snooze option and records no event', () => {
    const e = makeEmail()
    const r = e.snooze('bogus', NOW)
    expect(r.ok).toBe(false)
    expect(e.pullEvents()).toHaveLength(0)
  })

  it('unsnooze returns to the inbox, unread, marker dropped', () => {
    const e = makeEmail({ read: false })
    e.snooze('1h', NOW)
    e.pullEvents()
    e.unsnooze(NOW)
    expect(e.folder).toBe('inbox')
    expect(e.read).toBe(false)
    expect(e.labels.some(isSnoozeLabel)).toBe(false)
    expect(e.pullEvents().map((ev) => ev.name)).toContain('email.EmailUnsnoozed')
  })
})

describe('Email.sent', () => {
  it('lands read in the sent folder and records EmailSent', () => {
    const e = Email.sent(
      EmailId.of('e2'),
      {
        accountId: 'acc-1',
        externalId: 'ext-2',
        threadId: null,
        fromName: 'Me',
        fromEmail: 'me@example.com',
        to: ['x@example.com'],
        cc: [],
        subject: 'Out',
        bodyHtml: '<p>Bye</p>',
      },
      NOW,
    )
    expect(e.folder).toBe('sent')
    expect(e.read).toBe(true)
    expect(e.preview).toBe('Bye')
    expect(e.pullEvents().map((ev) => ev.name)).toEqual(['email.EmailSent'])
  })
})

describe('Email.bodyForAi', () => {
  it('prefers the text body', () => {
    expect(makeEmail({ bodyText: 'text', bodyHtml: '<p>html</p>' }).bodyForAi()).toBe('text')
  })

  it('falls back to HTML stripped of tags', () => {
    expect(makeEmail({ bodyText: null, bodyHtml: '<p>html</p>' }).bodyForAi()).toBe('html')
  })
})
