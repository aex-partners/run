import { describe, it, expect } from 'vitest'
import { PermanentDeleteFileService } from '@/contexts/files/application/use-cases/PermanentDeleteFileService'
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
  async findTrashedByOwner(): Promise<File[]> {
    return []
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

const seedFile = (repo: FakeFileRepo, id: string, path: string): File => {
  const f = (File.upload(FileId.of(id), { name: 'a.txt', size: 1, path, source: 'upload', ownerId: 'u1' }, NOW) as {
    ok: true
    value: File
  }).value
  f.pullEvents()
  repo.store.set(id, f)
  return f
}

const seedFolder = (repo: FakeFileRepo, id: string): File => {
  const f = (File.createFolder(FileId.of(id), 'docs', 'u1', null, NOW) as { ok: true; value: File }).value
  f.pullEvents()
  repo.store.set(id, f)
  return f
}

const setup = () => {
  const files = new FakeFileRepo()
  const storage = new FakeFileStorage()
  const events = new RecordingPublisher()
  const service = new PermanentDeleteFileService(files, storage, events, fixedClock(NOW))
  return { files, storage, events, service }
}

describe('PermanentDeleteFileService', () => {
  it('fails when the file does not exist', async () => {
    const { files, storage, events, service } = setup()
    const res = await service.execute({ id: 'missing' })
    expect(res.ok).toBe(false)
    expect(storage.deletedPaths).toHaveLength(0)
    expect(files.deleted).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('drops the bytes then the row and publishes FileDeleted for a byte-bearing file', async () => {
    const { files, storage, events, service } = setup()
    const f = seedFile(files, 'f1', 'owner/f1.txt')
    const res = await service.execute({ id: 'f1' })
    expect(res.ok).toBe(true)
    expect(storage.deletedPaths).toEqual(['owner/f1.txt'])
    expect(files.deleted).toContain(f)
    expect(files.store.has('f1')).toBe(false)
    expect(events.events.map((e) => e.name)).toEqual(['files.FileDeleted'])
  })

  it('skips storage deletion for a folder (no bytes) but still removes the row', async () => {
    const { files, storage, events, service } = setup()
    const folder = seedFolder(files, 'folder-1')
    const res = await service.execute({ id: 'folder-1' })
    expect(res.ok).toBe(true)
    expect(storage.deletedPaths).toHaveLength(0)
    expect(files.deleted).toContain(folder)
    expect(events.events.map((e) => e.name)).toEqual(['files.FileDeleted'])
  })
})
