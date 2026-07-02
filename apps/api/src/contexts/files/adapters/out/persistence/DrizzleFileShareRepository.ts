import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { fileShares } from '@/platform/db/schema'
import { FileShareRepository } from '@/contexts/files/application/ports/out/FileShareRepository'
import { FileShare } from '@/contexts/files/domain/FileShare'
import { FileShareId, FileId } from '@/contexts/files/domain/ids'
import { FileShareMapper, FileShareRow } from '@/contexts/files/application/mappers/FileShareMapper'

export class DrizzleFileShareRepository implements FileShareRepository {
  constructor(private readonly db: Database) {}

  nextId(): FileShareId {
    return FileShareId.of(randomUUID())
  }

  async findByFileAndUser(fileId: FileId, userId: string): Promise<FileShare | null> {
    const [row] = await this.db
      .select()
      .from(fileShares)
      .where(and(eq(fileShares.fileId, fileId.value), eq(fileShares.userId, userId)))
      .limit(1)
    return row ? FileShareMapper.toDomain(row as FileShareRow) : null
  }

  async save(share: FileShare): Promise<void> {
    const values = FileShareMapper.toValues(share)
    const { id, ...mutable } = values
    await this.db
      .insert(fileShares)
      .values(values)
      .onConflictDoUpdate({ target: fileShares.id, set: mutable })
  }

  async delete(share: FileShare): Promise<void> {
    await this.db.delete(fileShares).where(eq(fileShares.id, share.id.value))
  }
}
