import { describe, it, expect } from 'vitest'
import { Credential } from '@/contexts/credentials/domain/Credential'
import { CredentialId } from '@/contexts/credentials/domain/ids'
import { CredentialType } from '@/contexts/credentials/domain/CredentialType'
import { CredentialStatus } from '@/contexts/credentials/domain/CredentialStatus'
import { JsonObject } from '@/shared/domain/Json'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

// Narrowing accessor for the single recorded event (noUncheckedIndexedAccess).
const ev = (events: DomainEvent[]): DomainEvent => {
  const e = events[0]
  if (!e) throw new Error('expected a recorded event')
  return e
}

const NOW = new Date('2026-06-29T09:00:00.000Z')
const LATER = new Date('2026-06-29T10:00:00.000Z')
const id = CredentialId.of('cred-1')
const value: JsonObject = { token: 'abc' }

const created = (over: Partial<Parameters<typeof Credential.create>[0]> = {}): Credential => {
  const r = Credential.create({
    id,
    name: 'My Cred',
    pluginName: 'erp',
    type: 'secret_text',
    value,
    createdBy: 'user-1',
    now: NOW,
    ...over,
  })
  if (!r.ok) throw new Error(r.error)
  r.value.pullEvents()
  return r.value
}

describe('Credential.create', () => {
  it('creates an active credential and records CredentialCreated', () => {
    const r = Credential.create({
      id,
      name: '  My Cred  ',
      pluginName: 'erp',
      type: 'secret_text',
      value,
      createdBy: 'user-1',
      now: NOW,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const c = r.value
    expect(c.name).toBe('My Cred') // trimmed
    expect(c.pluginName).toBe('erp')
    expect(c.type).toBe('secret_text')
    expect(c.status).toBe('active')
    expect(c.isPrimary).toBe(false) // defaults to false
    expect(c.value).toEqual(value)
    expect(c.createdBy).toBe('user-1')
    expect(c.createdAt).toEqual(NOW)
    expect(c.updatedAt).toEqual(NOW)
    const events = c.pullEvents()
    expect(events).toHaveLength(1)
    expect(ev(events).name).toBe('credentials.CredentialCreated')
    expect(ev(events).aggregateId).toBe('cred-1')
  })

  it('honors an explicit isPrimary flag', () => {
    expect(created({ isPrimary: true }).isPrimary).toBe(true)
  })

  it('rejects an empty / whitespace name', () => {
    expect(Credential.create({ id, name: '   ', pluginName: 'erp', type: 'secret_text', value, createdBy: null, now: NOW }).ok).toBe(false)
  })

  it('rejects an empty pluginName', () => {
    expect(Credential.create({ id, name: 'x', pluginName: '  ', type: 'secret_text', value, createdBy: null, now: NOW }).ok).toBe(false)
  })

  it('accepts every CredentialType', () => {
    const types: CredentialType[] = ['oauth2', 'secret_text', 'basic_auth', 'custom_auth']
    for (const type of types) {
      const c = created({ type })
      expect(c.type).toBe(type)
    }
  })
})

describe('Credential.update', () => {
  it('applies a name change and bumps updatedAt + records CredentialUpdated', () => {
    const c = created()
    const r = c.update({ name: '  Renamed  ', now: LATER })
    expect(r.ok).toBe(true)
    expect(c.name).toBe('Renamed')
    expect(c.updatedAt).toEqual(LATER)
    const events = c.pullEvents()
    expect(events).toHaveLength(1)
    expect(ev(events).name).toBe('credentials.CredentialUpdated')
  })

  it('rejects an empty name patch', () => {
    const c = created()
    expect(c.update({ name: '   ', now: LATER }).ok).toBe(false)
    expect(c.name).toBe('My Cred')
  })

  it('replaces the value bag and updates status', () => {
    const c = created()
    const newValue: JsonObject = { token: 'xyz' }
    const r = c.update({ value: newValue, status: 'error', now: LATER })
    expect(r.ok).toBe(true)
    expect(c.value).toEqual(newValue)
    expect(c.status).toBe('error')
  })

  it('an empty patch still bumps updatedAt and records an event (unconditional update)', () => {
    const c = created()
    const r = c.update({ now: LATER })
    expect(r.ok).toBe(true)
    expect(c.updatedAt).toEqual(LATER)
    const events = c.pullEvents()
    expect(events).toHaveLength(1)
    expect(ev(events).name).toBe('credentials.CredentialUpdated')
    // The event carries the (unchanged) current status.
    expect((ev(events) as unknown as { status: CredentialStatus }).status).toBe('active')
  })
})

describe('Credential.applyRefreshedTokens', () => {
  it('stores the new value, reactivates, and records CredentialRefreshed', () => {
    const c = created({ type: 'oauth2' })
    // Take it to error first to prove reactivation.
    c.markRefreshError(LATER)
    c.pullEvents()
    const refreshed: JsonObject = { access_token: 'new' }
    c.applyRefreshedTokens(refreshed, LATER)
    expect(c.value).toEqual(refreshed)
    expect(c.status).toBe('active')
    expect(c.updatedAt).toEqual(LATER)
    const events = c.pullEvents()
    expect(events).toHaveLength(1)
    expect(ev(events).name).toBe('credentials.CredentialRefreshed')
  })
})

describe('Credential.markRefreshError', () => {
  it('flips status to error and records CredentialUpdated(error)', () => {
    const c = created({ type: 'oauth2' })
    c.markRefreshError(LATER)
    expect(c.status).toBe('error')
    expect(c.updatedAt).toEqual(LATER)
    const events = c.pullEvents()
    expect(events).toHaveLength(1)
    expect(ev(events).name).toBe('credentials.CredentialUpdated')
    expect((ev(events) as unknown as { status: CredentialStatus }).status).toBe('error')
  })
})

describe('Credential.markDeleted', () => {
  it('records a CredentialDeleted event', () => {
    const c = created()
    c.markDeleted(LATER)
    const events = c.pullEvents()
    expect(events).toHaveLength(1)
    expect(ev(events).name).toBe('credentials.CredentialDeleted')
    expect(ev(events).aggregateId).toBe('cred-1')
  })
})

describe('Credential.rehydrate', () => {
  it('restores stored state without re-validating or recording events', () => {
    const c = Credential.rehydrate({
      id,
      name: '',
      pluginName: 'erp',
      type: 'oauth2',
      status: 'missing',
      isPrimary: true,
      value,
      createdBy: null,
      createdAt: NOW,
      updatedAt: LATER,
    })
    expect(c.name).toBe('') // trusted: no validation
    expect(c.status).toBe('missing')
    expect(c.isPrimary).toBe(true)
    expect(c.pullEvents()).toHaveLength(0)
  })
})
