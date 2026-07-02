import { describe, it, expect } from 'vitest'
import { ToggleAiIndexService } from '@/contexts/files/application/use-cases/ToggleAiIndexService'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { FileIndexingQueue, FileIndexingRequest } from '@/contexts/files/application/ports/out/FileIndexingQueue'
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

class FakeIndexingQueue implements FileIndexingQueue {
  readonly requests: FileIndexingRequest[] = []
  async enqueue(request: FileIndexingRequest): Promise<void> {
    this.requests.push(request)
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
  const indexing = new FakeIndexingQueue()
  const events = new RecordingPublisher()
  const service = new ToggleAiIndexService(files, indexing, events, fixedClock(NOW))
  return { files, indexing, events, service }
}

describe('ToggleAiIndexService', () => {
  it('fails when the file does not exist', async () => {
    const { files, indexing, events, service } = setup()
    const res = await service.execute({ id: 'missing', enabled: true })
    expect(res.ok).toBe(false)
    expect(files.saved).toHaveLength(0)
    expect(indexing.requests).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('enables indexing, enqueues an index request and publishes FileAiIndexChanged', async () => {
    const { files, indexing, events, service } = setup()
    const f = seedFile(files, 'f1')
    const res = await service.execute({ id: 'f1', enabled: true })
    expect(res.ok).toBe(true)
    expect(res.ok && res.value.aiIndexed).toBe(true)
    expect(f.aiIndexed).toBe(true)
    expect(files.saved).toContain(f)
    expect(indexing.requests).toEqual([{ fileId: 'f1', ownerId: 'u1', action: 'index' }])
    expect(events.events.map((e) => e.name)).toEqual(['files.FileAiIndexChanged'])
  })

  it('disables indexing and enqueues a deindex request', async () => {
    const { indexing, service, files } = setup()
    const f = seedFile(files, 'f1')
    f.setAiIndexed(true, NOW)
    f.pullEvents()
    const res = await service.execute({ id: 'f1', enabled: false })
    expect(res.ok).toBe(true)
    expect(res.ok && res.value.aiIndexed).toBe(false)
    expect(f.aiIndexed).toBe(false)
    expect(indexing.requests).toEqual([{ fileId: 'f1', ownerId: 'u1', action: 'deindex' }])
  })
})
