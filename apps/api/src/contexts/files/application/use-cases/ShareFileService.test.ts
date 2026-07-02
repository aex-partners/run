import { describe, it, expect } from 'vitest'
import { ShareFileService } from '@/contexts/files/application/use-cases/ShareFileService'
import { FileShareRepository } from '@/contexts/files/application/ports/out/FileShareRepository'
import { UserDirectory } from '@/contexts/files/application/ports/out/UserDirectory'
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
    this.store.delete(key(share.fileId.value, share.userId))
  }
}

class FakeUserDirectory implements UserDirectory {
  constructor(private byEmail: Map<string, string>) {}
  async findUserIdByEmail(email: string): Promise<string | null> {
    return this.byEmail.get(email) ?? null
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const setup = (emails: Array<[string, string]> = [['bob@x.com', 'u-bob']]) => {
  const shares = new FakeShareRepo()
  const users = new FakeUserDirectory(new Map(emails))
  const events = new RecordingPublisher()
  const service = new ShareFileService(shares, users, events, fixedClock(NOW))
  return { shares, users, events, service }
}

describe('ShareFileService', () => {
  it('resolves the grantee by email and records a new share', async () => {
    const { shares, events, service } = setup()
    const res = await service.execute({ fileId: 'f1', email: 'bob@x.com', access: 'editor' })
    expect(res.ok).toBe(true)
    const saved = shares.store.get('f1::u-bob')!
    expect(saved.userId).toBe('u-bob')
    expect(saved.access).toBe('editor')
    expect(events.events.map((e) => e.name)).toEqual(['files.FileShared'])
  })

  it('fails when the email does not resolve to a user', async () => {
    const { shares, events, service } = setup([])
    const res = await service.execute({ fileId: 'f1', email: 'ghost@x.com', access: 'viewer' })
    expect(res.ok).toBe(false)
    expect(shares.store.size).toBe(0)
    expect(events.events).toHaveLength(0)
  })

  it('rejects a duplicate grant for the same file and user', async () => {
    const { shares, events, service } = setup()
    shares.store.set('f1::u-bob', FileShare.create(FileShareId.of('s-existing'), FileId.of('f1'), 'u-bob', 'viewer', NOW))
    const res = await service.execute({ fileId: 'f1', email: 'bob@x.com', access: 'editor' })
    expect(res.ok).toBe(false)
    // existing grant untouched
    expect(shares.store.get('f1::u-bob')!.access).toBe('viewer')
    expect(events.events).toHaveLength(0)
  })
})
