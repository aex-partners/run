import { describe, it, expect } from 'vitest'
import { TrashFileService } from '@/contexts/files/application/use-cases/TrashFileService'
import { RestoreFileService } from '@/contexts/files/application/use-cases/RestoreFileService'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { File } from '@/contexts/files/domain/File'
import { FileId } from '@/contexts/files/domain/ids'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

class FakeFileRepo implements FileRepository {
  private seq = 0
  readonly store = new Map<string, File>()
  nextId(): FileId {
    this.seq += 1
    return FileId.of(`f-${this.seq}`)
  }
  nextPublicToken(): string {
    return 'token'
  }
  async findById(id: FileId): Promise<File | null> {
    return this.store.get(id.value) ?? null
  }
  async save(file: File): Promise<void> {
    this.store.set(file.id.value, file)
  }
  async delete(): Promise<void> {}
  async findTrashedByOwner(): Promise<File[]> {
    return []
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const seedFile = (repo: FakeFileRepo, id: string, deleted = false): File => {
  const f = (File.upload(FileId.of(id), { name: 'a.txt', size: 1, path: 'p', source: 'upload', ownerId: 'u1' }, NOW) as {
    ok: true
    value: File
  }).value
  if (deleted) f.trash(NOW)
  f.pullEvents()
  repo.store.set(id, f)
  return f
}

describe('TrashFileService', () => {
  it('fails when the file is missing', async () => {
    const files = new FakeFileRepo()
    const events = new RecordingPublisher()
    const res = await new TrashFileService(files, events, fixedClock(NOW)).execute({ id: 'missing' })
    expect(res.ok).toBe(false)
    expect(events.events).toHaveLength(0)
  })

  it('soft-deletes the file, saves and publishes FileTrashed', async () => {
    const files = new FakeFileRepo()
    const events = new RecordingPublisher()
    const f = seedFile(files, 'f1')
    const res = await new TrashFileService(files, events, fixedClock(NOW)).execute({ id: 'f1' })
    expect(res.ok).toBe(true)
    expect(f.deletedAt).toEqual(NOW)
    expect(events.events.map((e) => e.name)).toEqual(['files.FileTrashed'])
  })
})

describe('RestoreFileService', () => {
  it('fails when the file is missing', async () => {
    const files = new FakeFileRepo()
    const events = new RecordingPublisher()
    const res = await new RestoreFileService(files, events, fixedClock(NOW)).execute({ id: 'missing' })
    expect(res.ok).toBe(false)
    expect(events.events).toHaveLength(0)
  })

  it('clears deletedAt, saves and publishes FileRestored', async () => {
    const files = new FakeFileRepo()
    const events = new RecordingPublisher()
    const f = seedFile(files, 'f1', true)
    expect(f.deletedAt).not.toBeNull()
    const res = await new RestoreFileService(files, events, fixedClock(NOW)).execute({ id: 'f1' })
    expect(res.ok).toBe(true)
    expect(f.deletedAt).toBeNull()
    expect(events.events.map((e) => e.name)).toEqual(['files.FileRestored'])
  })
})
