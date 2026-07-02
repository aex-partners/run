import { describe, it, expect } from 'vitest'
import { StarFileService } from '@/contexts/files/application/use-cases/StarFileService'
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
  const service = new StarFileService(files, events, fixedClock(NOW))
  return { files, events, service }
}

describe('StarFileService', () => {
  it('fails when the file does not exist', async () => {
    const { files, events, service } = setup()
    const res = await service.execute({ id: 'missing' })
    expect(res.ok).toBe(false)
    expect(files.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('stars an unstarred file, saves and publishes FileStarred', async () => {
    const { files, events, service } = setup()
    const f = seedFile(files, 'f1')
    expect(f.starred).toBe(false)
    const res = await service.execute({ id: 'f1' })
    expect(res.ok).toBe(true)
    expect(res.ok && res.value.starred).toBe(true)
    expect(f.starred).toBe(true)
    expect(files.saved).toContain(f)
    expect(events.events.map((e) => e.name)).toEqual(['files.FileStarred'])
  })

  it('unstars a starred file on a second toggle', async () => {
    const { files, service } = setup()
    const f = seedFile(files, 'f1')
    f.toggleStar(NOW)
    f.pullEvents()
    expect(f.starred).toBe(true)
    const res = await service.execute({ id: 'f1' })
    expect(res.ok).toBe(true)
    expect(res.ok && res.value.starred).toBe(false)
    expect(f.starred).toBe(false)
  })
})
