import { randomUUID } from 'node:crypto'
import { and, eq, isNotNull } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { files } from '@/platform/db/schema'
import { FileRepository } from '@/contexts/files/application/ports/out/FileRepository'
import { File } from '@/contexts/files/domain/File'
import { FileId } from '@/contexts/files/domain/ids'
import { FileMapper, FileRow } from '@/contexts/files/application/mappers/FileMapper'

// Driven adapter over the Postgres `files` table. The port and mapper stay
// identical to any other backing store.
export class DrizzleFileRepository implements FileRepository {
  constructor(private readonly db: Database) {}

  nextId(): FileId {
    return FileId.of(randomUUID())
  }

  nextPublicToken(): string {
    return randomUUID()
  }

  async findById(id: FileId): Promise<File | null> {
    const [row] = await this.db.select().from(files).where(eq(files.id, id.value)).limit(1)
    return row ? FileMapper.toDomain(row as FileRow) : null
  }

  async save(file: File): Promise<void> {
    const values = FileMapper.toValues(file)
    const { id, ...mutable } = values
    await this.db
      .insert(files)
      .values(values)
      .onConflictDoUpdate({ target: files.id, set: mutable })
  }

  async delete(file: File): Promise<void> {
    await this.db.delete(files).where(eq(files.id, file.id.value))
  }

  async findTrashedByOwner(ownerId: string): Promise<File[]> {
    const rows = await this.db
      .select()
      .from(files)
      .where(and(isNotNull(files.deletedAt), eq(files.ownerId, ownerId)))
    return rows.map((row) => FileMapper.toDomain(row as FileRow))
  }
}
