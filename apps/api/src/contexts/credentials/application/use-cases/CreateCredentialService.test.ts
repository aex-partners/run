import { describe, it, expect } from 'vitest'
import { CreateCredentialService } from '@/contexts/credentials/application/use-cases/CreateCredentialService'
import { CredentialRepository } from '@/contexts/credentials/application/ports/out/CredentialRepository'
import { Credential } from '@/contexts/credentials/domain/Credential'
import { CredentialId } from '@/contexts/credentials/domain/ids'
import { CredentialCandidate } from '@/contexts/credentials/domain/CredentialResolution'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00.000Z')

class InMemoryCredentialRepository implements CredentialRepository {
  private seq = 0
  readonly store = new Map<string, Credential>()
  readonly deleted: string[] = []
  nextId(): CredentialId {
    this.seq += 1
    return CredentialId.of(`cred-${this.seq}`)
  }
  async findById(id: CredentialId): Promise<Credential | null> {
    return this.store.get(id.value) ?? null
  }
  async findActiveCandidatesByPlugin(pluginName: string): Promise<CredentialCandidate[]> {
    return [...this.store.values()]
      .filter((c) => c.pluginName === pluginName && c.status === 'active')
      .map((c) => ({ id: c.id.value, isPrimary: c.isPrimary, createdAt: c.createdAt, status: c.status }))
  }
  async listOAuth2Ids(): Promise<string[]> {
    return [...this.store.values()].filter((c) => c.type === 'oauth2').map((c) => c.id.value)
  }
  async save(credential: Credential): Promise<void> {
    this.store.set(credential.id.value, credential)
  }
  async delete(id: CredentialId): Promise<void> {
    this.store.delete(id.value)
    this.deleted.push(id.value)
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const fixedClock = (now: Date): Clock => ({ now: () => now })

const setup = () => {
  const credentials = new InMemoryCredentialRepository()
  const events = new RecordingPublisher()
  const service = new CreateCredentialService(credentials, events, fixedClock(NOW))
  return { credentials, events, service }
}

describe('CreateCredentialService', () => {
  it('creates an active secret_text credential, persists it, and publishes CredentialCreated', async () => {
    const { credentials, events, service } = setup()
    const r = await service.execute({
      name: 'My API key',
      pluginName: 'erp',
      type: 'secret_text',
      value: { token: 'abc' },
      userId: 'user-1',
    })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.id).toBe('cred-1')

    const saved = credentials.store.get('cred-1')
    expect(saved?.status).toBe('active')
    expect(saved?.type).toBe('secret_text')
    expect(saved?.isPrimary).toBe(false)
    expect(saved?.value).toEqual({ token: 'abc' })
    expect(saved?.createdBy).toBe('user-1')
    expect(saved?.createdAt).toEqual(NOW)

    expect(events.events.map((e) => e.name)).toEqual(['credentials.CredentialCreated'])
  })

  it('supports the oauth2 type variant', async () => {
    const { credentials, service } = setup()
    const r = await service.execute({
      name: 'OAuth cred',
      pluginName: 'gmail',
      type: 'oauth2',
      value: { access_token: 'x' },
      userId: 'user-1',
    })
    expect(r.ok).toBe(true)
    expect(credentials.store.get('cred-1')?.type).toBe('oauth2')
  })

  it('uses a fresh repository id per creation', async () => {
    const { service } = setup()
    const a = await service.execute({ name: 'a', pluginName: 'p', type: 'secret_text', value: {}, userId: 'u' })
    const b = await service.execute({ name: 'b', pluginName: 'p', type: 'secret_text', value: {}, userId: 'u' })
    expect(a.ok && a.value.id).toBe('cred-1')
    expect(b.ok && b.value.id).toBe('cred-2')
  })

  it('fails on an empty name without persisting or publishing', async () => {
    const { credentials, events, service } = setup()
    const r = await service.execute({
      name: '   ',
      pluginName: 'erp',
      type: 'secret_text',
      value: {},
      userId: 'user-1',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toMatch(/name is required/)
    expect(credentials.store.size).toBe(0)
    expect(events.events).toHaveLength(0)
  })

  it('fails on a blank pluginName without persisting', async () => {
    const { credentials, service } = setup()
    const r = await service.execute({
      name: 'has name',
      pluginName: '   ',
      type: 'secret_text',
      value: {},
      userId: 'user-1',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toMatch(/pluginName is required/)
    expect(credentials.store.size).toBe(0)
  })
})
