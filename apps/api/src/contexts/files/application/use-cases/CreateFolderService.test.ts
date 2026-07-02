import { describe, it, expect } from 'vitest'
import { CreateFolderService } from '@/contexts/files/application/use-cases/CreateFolderService'
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

const setup = () => {
  const files = new FakeFileRepo()
  const events = new RecordingPublisher()
  const service = new CreateFolderService(files, events, fixedClock(NOW))
  return { files, events, service }
}

describe('CreateFolderService', () => {
  it('creates a folder, persists it and publishes FolderCreated', async () => {
    const { files, events, service } = setup()
    const res = await service.execute({ ownerId: 'u1', name: 'Docs', parentId: 'root-1' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const folder = files.store.get(res.value.id)!
    expect(folder.isFolder).toBe(true)
    expect(folder.name).toBe('Docs')
    expect(folder.parentId?.value).toBe('root-1')
    expect(events.events.map((e) => e.name)).toEqual(['files.FolderCreated'])
  })

  it('fails on a blank name without saving or publishing', async () => {
    const { files, events, service } = setup()
    const res = await service.execute({ ownerId: 'u1', name: '   ' })
    expect(res.ok).toBe(false)
    expect(files.store.size).toBe(0)
    expect(events.events).toHaveLength(0)
  })
})
