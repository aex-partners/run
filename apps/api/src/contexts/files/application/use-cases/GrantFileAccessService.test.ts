import { describe, it, expect } from 'vitest'
import { GrantFileAccessService } from '@/contexts/files/application/use-cases/GrantFileAccessService'
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
  readonly saves: string[] = []
  nextId(): FileShareId {
    this.seq += 1
    return FileShareId.of(`s-${this.seq}`)
  }
  async findByFileAndUser(fileId: FileId, userId: string): Promise<FileShare | null> {
    return this.store.get(key(fileId.value, userId)) ?? null
  }
  async save(share: FileShare): Promise<void> {
    this.saves.push(key(share.fileId.value, share.userId))
    this.store.set(key(share.fileId.value, share.userId), share)
  }
  async delete(share: FileShare): Promise<void> {
    this.store.delete(key(share.fileId.value, share.userId))
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  publishCalls = 0
  async publish(events: DomainEvent[]): Promise<void> {
    this.publishCalls += 1
    this.events.push(...events)
  }
}

const setup = () => {
  const shares = new FakeShareRepo()
  const events = new RecordingPublisher()
  const service = new GrantFileAccessService(shares, events, fixedClock(NOW))
  return { shares, events, service }
}

describe('GrantFileAccessService', () => {
  it('upserts a viewer share for every file x user pair by default', async () => {
    const { shares, events, service } = setup()
    await service.execute({ fileIds: ['f1', 'f2'], userIds: ['u1', 'u2'] })
    expect(shares.store.size).toBe(4)
    for (const k of ['f1::u1', 'f1::u2', 'f2::u1', 'f2::u2']) {
      expect(shares.store.get(k)!.access).toBe('viewer')
    }
    expect(events.events.map((e) => e.name)).toEqual(Array(4).fill('files.FileShared'))
  })

  it('honors an explicit access level', async () => {
    const { shares, service } = setup()
    await service.execute({ fileIds: ['f1'], userIds: ['u1'], access: 'editor' })
    expect(shares.store.get('f1::u1')!.access).toBe('editor')
  })

  it('leaves an existing grant at the requested access untouched (no save, no publish)', async () => {
    const { shares, events, service } = setup()
    // A persisted share is rehydrated (no pending events), matching production.
    shares.store.set(
      'f1::u1',
      FileShare.rehydrate(FileShareId.of('s-pre'), { fileId: 'f1', userId: 'u1', access: 'viewer', createdAt: NOW }),
    )
    await service.execute({ fileIds: ['f1'], userIds: ['u1'], access: 'viewer' })
    expect(shares.saves).toHaveLength(0)
    expect(events.publishCalls).toBe(0)
    expect(events.events).toHaveLength(0)
  })

  it('upgrades an existing grant whose access differs, recording FileAccessChanged', async () => {
    const { shares, events, service } = setup()
    shares.store.set(
      'f1::u1',
      FileShare.rehydrate(FileShareId.of('s-pre'), { fileId: 'f1', userId: 'u1', access: 'viewer', createdAt: NOW }),
    )
    await service.execute({ fileIds: ['f1'], userIds: ['u1'], access: 'editor' })
    expect(shares.store.get('f1::u1')!.access).toBe('editor')
    expect(events.events.map((e) => e.name)).toEqual(['files.FileAccessChanged'])
  })

  it('does not call publish when nothing changed', async () => {
    const { events, service } = setup()
    await service.execute({ fileIds: [], userIds: [] })
    expect(events.publishCalls).toBe(0)
  })
})
