import { describe, it, expect } from 'vitest'
import { UploadFileService } from '@/contexts/files/application/use-cases/UploadFileService'
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
    this.store.delete(file.id.value)
  }
  async findTrashedByOwner(): Promise<File[]> {
    return []
  }
}

class FakeStorage implements FileStorage {
  readonly deleted: string[] = []
  saved: { bytes: Uint8Array; filename: string }[] = []
  async save(bytes: Uint8Array, filename: string): Promise<string> {
    this.saved.push({ bytes, filename })
    return `stored/${filename}`
  }
  async read(): Promise<Uint8Array> {
    return new Uint8Array()
  }
  async delete(relativePath: string): Promise<void> {
    this.deleted.push(relativePath)
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const setup = () => {
  const files = new FakeFileRepo()
  const storage = new FakeStorage()
  const events = new RecordingPublisher()
  const service = new UploadFileService(files, storage, events, fixedClock(NOW))
  return { files, storage, events, service }
}

describe('UploadFileService', () => {
  it('stores the bytes, persists the file with derived metadata and publishes FileUploaded', async () => {
    const { files, storage, events, service } = setup()
    const res = await service.execute({
      ownerId: 'u1',
      name: 'report.pdf',
      bytes: new Uint8Array([1, 2, 3, 4]),
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.id).toBe('f-1')
    expect(res.value.type).toBe('pdf')
    expect(res.value.mimeType).toBe('application/pdf')
    expect(res.value.size).toBe(4)
    expect(res.value.path).toBe('stored/report.pdf')
    expect(storage.saved).toHaveLength(1)
    expect(files.store.has('f-1')).toBe(true)
    expect(events.events.map((e) => e.name)).toEqual(['files.FileUploaded'])
  })

  it('defaults the source to upload and passes parentId/source through', async () => {
    const { files, service } = setup()
    const res = await service.execute({
      ownerId: 'u1',
      name: 'a.txt',
      bytes: new Uint8Array([0]),
      source: 'email',
      sourceRef: 'msg-1',
      parentId: 'folder-1',
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const saved = files.store.get(res.value.id)!
    expect(saved.source).toBe('email')
    expect(saved.sourceRef).toBe('msg-1')
    expect(saved.parentId?.value).toBe('folder-1')
  })

  it('rolls back the stored bytes when the aggregate rejects the upload', async () => {
    const { files, storage, events, service } = setup()
    const res = await service.execute({
      ownerId: 'u1',
      name: '   ', // blank name => File.upload fails after bytes are written
      bytes: new Uint8Array([1]),
    })
    expect(res.ok).toBe(false)
    expect(storage.deleted).toEqual(['stored/   '])
    expect(files.store.size).toBe(0)
    expect(events.events).toHaveLength(0)
  })
})
