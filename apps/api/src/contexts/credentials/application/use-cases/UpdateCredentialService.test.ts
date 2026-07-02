import { describe, it, expect } from 'vitest'
import { UpdateCredentialService } from '@/contexts/credentials/application/use-cases/UpdateCredentialService'
import { CredentialRepository } from '@/contexts/credentials/application/ports/out/CredentialRepository'
import { TokenCache } from '@/contexts/credentials/application/ports/out/TokenCache'
import { Credential } from '@/contexts/credentials/domain/Credential'
import { CredentialId } from '@/contexts/credentials/domain/ids'
import { CredentialCandidate } from '@/contexts/credentials/domain/CredentialResolution'
import { JsonObject } from '@/shared/domain/Json'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const EARLIER = new Date('2025-12-01T00:00:00.000Z')
const NOW = new Date('2026-01-01T00:00:00.000Z')

class InMemoryCredentialRepository implements CredentialRepository {
  private seq = 0
  readonly store = new Map<string, Credential>()
  nextId(): CredentialId {
    this.seq += 1
    return CredentialId.of(`cred-${this.seq}`)
  }
  async findById(id: CredentialId): Promise<Credential | null> {
    return this.store.get(id.value) ?? null
  }
  async findActiveCandidatesByPlugin(): Promise<CredentialCandidate[]> {
    return []
  }
  async listOAuth2Ids(): Promise<string[]> {
    return []
  }
  async save(credential: Credential): Promise<void> {
    this.store.set(credential.id.value, credential)
  }
  async delete(id: CredentialId): Promise<void> {
    this.store.delete(id.value)
  }
}

class InMemoryTokenCache implements TokenCache {
  readonly store = new Map<string, JsonObject>()
  readonly invalidated: string[] = []
  get(id: string): JsonObject | null {
    return this.store.get(id) ?? null
  }
  set(id: string, value: JsonObject): void {
    this.store.set(id, value)
  }
  invalidate(id: string): void {
    this.store.delete(id)
    this.invalidated.push(id)
  }
  clear(): void {
    this.store.clear()
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const fixedClock = (now: Date): Clock => ({ now: () => now })

const seed = (over: Partial<Parameters<typeof Credential.rehydrate>[0]> = {}): Credential =>
  Credential.rehydrate({
    id: CredentialId.of('cred-1'),
    name: 'Original',
    pluginName: 'erp',
    type: 'secret_text',
    status: 'active',
    isPrimary: false,
    value: { token: 'old' },
    createdBy: 'owner',
    createdAt: EARLIER,
    updatedAt: EARLIER,
    ...over,
  })

const setup = () => {
  const credentials = new InMemoryCredentialRepository()
  const cache = new InMemoryTokenCache()
  const events = new RecordingPublisher()
  const service = new UpdateCredentialService(credentials, cache, events, fixedClock(NOW))
  return { credentials, cache, events, service }
}

describe('UpdateCredentialService', () => {
  it('applies the owner patch, bumps updatedAt, publishes CredentialUpdated, invalidates cache', async () => {
    const { credentials, cache, events, service } = setup()
    credentials.store.set('cred-1', seed())

    const r = await service.execute({
      id: 'cred-1',
      userId: 'owner',
      name: 'Renamed',
      value: { token: 'new' },
      status: 'error',
    })

    expect(r.ok).toBe(true)
    const updated = credentials.store.get('cred-1')
    expect(updated?.name).toBe('Renamed')
    expect(updated?.value).toEqual({ token: 'new' })
    expect(updated?.status).toBe('error')
    expect(updated?.updatedAt).toEqual(NOW)

    expect(events.events.map((e) => e.name)).toEqual(['credentials.CredentialUpdated'])
    expect(cache.invalidated).toEqual(['cred-1'])
  })

  it('is a silent no-op (still ok) when the id is missing, but still invalidates the cache', async () => {
    const { credentials, cache, events, service } = setup()
    const r = await service.execute({ id: 'ghost', userId: 'owner', name: 'x' })
    expect(r.ok).toBe(true)
    expect(credentials.store.size).toBe(0)
    expect(events.events).toHaveLength(0)
    expect(cache.invalidated).toEqual(['ghost'])
  })

  it('is a silent no-op when the credential belongs to another user', async () => {
    const { credentials, cache, events, service } = setup()
    credentials.store.set('cred-1', seed({ createdBy: 'someone-else' }))

    const r = await service.execute({ id: 'cred-1', userId: 'owner', name: 'Hijack' })
    expect(r.ok).toBe(true)
    expect(credentials.store.get('cred-1')?.name).toBe('Original')
    expect(events.events).toHaveLength(0)
    // Cache is invalidated unconditionally, even on a non-owned no-op.
    expect(cache.invalidated).toEqual(['cred-1'])
  })

  it('returns a failure (and does NOT invalidate the cache) when the patch violates an invariant', async () => {
    const { credentials, cache, events, service } = setup()
    credentials.store.set('cred-1', seed())

    const r = await service.execute({ id: 'cred-1', userId: 'owner', name: '   ' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toMatch(/name is required/)
    expect(events.events).toHaveLength(0)
    // The early `return fail(...)` happens before cache.invalidate is reached.
    expect(cache.invalidated).toEqual([])
  })
})
