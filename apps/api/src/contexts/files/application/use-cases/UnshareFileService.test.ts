import { describe, it, expect } from 'vitest'
import { UnshareFileService } from '@/contexts/files/application/use-cases/UnshareFileService'
import { FileShareRepository } from '@/contexts/files/application/ports/out/FileShareRepository'
import { FileShare } from '@/contexts/files/domain/FileShare'
import { FileShareId, FileId } from '@/contexts/files/domain/ids'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

const key = (fileId: string, userId: string) => `${fileId}::${userId}`

class FakeShareRepo implements FileShareRepository {
  private seq = 0
  readonly store = new Map<string, FileShare>()
  readonly deleted: FileShare[] = []
  nextId(): FileShareId {
    this.seq += 1
    return FileShareId.of(`s-${this.seq}`)
  }
  async findByFileAndUser(fileId: FileId, userId: string): Promise<FileShare | null> {
    return this.store.get(key(fileId.value, userId)) ?? null
  }
  async save(share: FileShare): Promise<void> {
    this.store.set(key(share.fileId.value, share.userId), share)
  }
  async delete(share: FileShare): Promise<void> {
    this.deleted.push(share)
    this.store.delete(key(share.fileId.value, share.userId))
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const seedShare = (repo: FakeShareRepo, fileId: string, userId: string) => {
  const share = FileShare.create(FileShareId.of(`s-${fileId}-${userId}`), FileId.of(fileId), userId, 'viewer', NOW)
  share.pullEvents()
  repo.store.set(key(fileId, userId), share)
  return share
}

const setup = () => {
  const shares = new FakeShareRepo()
  const events = new RecordingPublisher()
  const service = new UnshareFileService(shares, events, fixedClock(NOW))
  return { shares, events, service }
}

describe('UnshareFileService', () => {
  it('revokes the share, deletes the row and publishes FileUnshared', async () => {
    const { shares, events, service } = setup()
    const share = seedShare(shares, 'f1', 'u-bob')
    const res = await service.execute({ fileId: 'f1', userId: 'u-bob' })
    expect(res.ok).toBe(true)
    expect(shares.deleted).toContain(share)
    expect(shares.store.has(key('f1', 'u-bob'))).toBe(false)
    expect(events.events.map((e) => e.name)).toEqual(['files.FileUnshared'])
  })

  it('is an idempotent no-op success when no share exists', async () => {
    const { shares, events, service } = setup()
    const res = await service.execute({ fileId: 'f1', userId: 'ghost' })
    expect(res.ok).toBe(true)
    expect(shares.deleted).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })
})
