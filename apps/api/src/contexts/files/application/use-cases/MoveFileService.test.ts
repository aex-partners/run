import { describe, it, expect } from 'vitest'
import { MoveFileService } from '@/contexts/files/application/use-cases/MoveFileService'
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
  readonly saved: File[] = []
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
    this.saved.push(file)
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

const seedFile = (repo: FakeFileRepo, id: string): File => {
  const f = (File.upload(FileId.of(id), { name: 'a.txt', size: 1, path: 'p', source: 'upload', ownerId: 'u1' }, NOW) as {
    ok: true
    value: File
  }).value
  f.pullEvents()
  repo.store.set(id, f)
  return f
}

const setup = () => {
  const files = new FakeFileRepo()
  const events = new RecordingPublisher()
  const service = new MoveFileService(files, events, fixedClock(NOW))
  return { files, events, service }
}

describe('MoveFileService', () => {
  it('fails when the file does not exist', async () => {
    const { events, service } = setup()
    const res = await service.execute({ id: 'missing', parentId: 'folder-1' })
    expect(res.ok).toBe(false)
    expect(events.events).toHaveLength(0)
  })

  it('moves the file under a new parent, saves and publishes FileMoved', async () => {
    const { files, events, service } = setup()
    const f = seedFile(files, 'f1')
    const res = await service.execute({ id: 'f1', parentId: 'folder-9' })
    expect(res.ok).toBe(true)
    expect(f.parentId?.value).toBe('folder-9')
    expect(files.saved).toContain(f)
    expect(events.events.map((e) => e.name)).toEqual(['files.FileMoved'])
  })

  it('moves to the root when parentId is null', async () => {
    const { files, service } = setup()
    const f = seedFile(files, 'f1')
    f.move(FileId.of('folder-9'), NOW)
    f.pullEvents()
    const res = await service.execute({ id: 'f1', parentId: null })
    expect(res.ok).toBe(true)
    expect(f.parentId).toBeNull()
  })

  it('enforces the self-parent guard and does not save', async () => {
    const { files, events, service } = setup()
    seedFile(files, 'f1')
    const res = await service.execute({ id: 'f1', parentId: 'f1' })
    expect(res.ok).toBe(false)
    expect(files.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })
})
