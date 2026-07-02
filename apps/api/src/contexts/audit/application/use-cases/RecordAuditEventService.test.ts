import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { RecordAuditEventService } from '@/contexts/audit/application/use-cases/RecordAuditEventService'
import { AuditRepository, AuditQueryFilter } from '@/contexts/audit/application/ports/out/AuditRepository'
import { AuditEntry } from '@/contexts/audit/domain/AuditEntry'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock: Clock = { now: () => NOW }

class FakeAuditRepo implements AuditRepository {
  appended: AuditEntry[] = []
  private seq = 0
  constructor(private readonly onAppend?: () => void) {}
  nextId(): string {
    return `audit-${++this.seq}`
  }
  async append(entry: AuditEntry): Promise<void> {
    if (this.onAppend) this.onAppend()
    this.appended.push(entry)
  }
  async query(_filter: AuditQueryFilter, _limit: number): Promise<AuditEntry[]> {
    return []
  }
}

describe('RecordAuditEventService', () => {
  it('builds a stamped entry and appends it', async () => {
    const repo = new FakeAuditRepo()
    const svc = new RecordAuditEventService(repo, clock)

    const res = await svc.execute({
      actorId: 'admin-1',
      actorEmail: 'admin@t.io',
      action: 'user.role_changed',
      resourceType: 'user',
      resourceId: 'user-9',
      metadata: { from: 'user', to: 'owner' },
    })

    expect(res.ok).toBe(true)
    expect(repo.appended).toHaveLength(1)
    expect(repo.appended[0]).toEqual({
      id: 'audit-1',
      actorId: 'admin-1',
      actorEmail: 'admin@t.io',
      action: 'user.role_changed',
      resourceType: 'user',
      resourceId: 'user-9',
      metadata: { from: 'user', to: 'owner' },
      createdAt: NOW,
    })
  })

  it('defaults optional attribution fields to null', async () => {
    const repo = new FakeAuditRepo()
    const svc = new RecordAuditEventService(repo, clock)

    const res = await svc.execute({ action: 'settings.changed', resourceType: 'settings' })

    expect(res.ok).toBe(true)
    expect(repo.appended[0]).toMatchObject({
      actorId: null,
      actorEmail: null,
      resourceId: null,
      metadata: null,
    })
  })

  it('is best-effort: a failed append returns a failure result instead of throwing', async () => {
    const repo = new FakeAuditRepo(() => {
      throw new Error('db offline')
    })
    const svc = new RecordAuditEventService(repo, clock)

    const res = await svc.execute({ action: 'settings.changed', resourceType: 'settings' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('db offline')
  })
})
