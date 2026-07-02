import { describe, it, expect } from 'vitest'
import { EmptyTrashService } from '@/contexts/files/application/use-cases/EmptyTrashService'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { FileStorage } from '@/contexts/files/application/ports/out/FileStorage'
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
  readonly deleted: File[] = []
  trashed: File[] = []
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
  async delete(file: File): Promise<void> {
    this.deleted.push(file)
    this.store.delete(file.id.value)
  }
  async findTrashedByOwner(ownerId: string): Promise<File[]> {
    return this.trashed.filter((f) => f.ownerId === ownerId)
  }
}

class FakeFileStorage implements FileStorage {
  readonly deletedPaths: string[] = []
  async save(): Promise<string> {
    return 'p'
  }
  async read(): Promise<Uint8Array> {
    return new Uint8Array()
  }
  async delete(relativePath: string): Promise<void> {
    this.deletedPaths.push(relativePath)
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const trashedFile = (id: string, path: string, ownerId = 'u1'): File => {
  const f = (File.upload(FileId.of(id), { name: 'a.txt', size: 1, path, source: 'upload', ownerId }, NOW) as {
    ok: true
    value: File
  }).value
  f.trash(NOW)
  f.pullEvents()
  return f
}

const trashedFolder = (id: string, ownerId = 'u1'): File => {
  const f = (File.createFolder(FileId.of(id), 'docs', ownerId, null, NOW) as { ok: true; value: File }).value
  f.trash(NOW)
  f.pullEvents()
  return f
}

const setup = () => {
  const files = new FakeFileRepo()
  const storage = new FakeFileStorage()
  const events = new RecordingPublisher()
  const service = new EmptyTrashService(files, storage, events, fixedClock(NOW))
  return { files, storage, events, service }
}

describe('EmptyTrashService', () => {
  it('returns deleted: 0 with no side effects when the trash is empty', async () => {
    const { files, storage, events, service } = setup()
    const res = await service.execute({ ownerId: 'u1' })
    expect(res.ok).toBe(true)
    expect(res.ok && res.value.deleted).toBe(0)
    expect(storage.deletedPaths).toHaveLength(0)
    expect(files.deleted).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('deletes bytes for byte-bearing files, removes every row and publishes one FileDeleted each', async () => {
    const { files, storage, events, service } = setup()
    const file1 = trashedFile('f1', 'owner/f1.txt')
    const file2 = trashedFile('f2', 'owner/f2.txt')
    const folder = trashedFolder('folder-1')
    files.trashed = [file1, file2, folder]

    const res = await service.execute({ ownerId: 'u1' })
    expect(res.ok).toBe(true)
    expect(res.ok && res.value.deleted).toBe(3)

    // bytes dropped for the two files, never for the folder (no path)
    expect(storage.deletedPaths.sort()).toEqual(['owner/f1.txt', 'owner/f2.txt'])

    // every row removed
    expect(files.deleted).toEqual([file1, file2, folder])

    // one FileDeleted per trashed node, drained and published together
    expect(events.events.map((e) => e.name)).toEqual([
      'files.FileDeleted',
      'files.FileDeleted',
      'files.FileDeleted',
    ])
  })
})
