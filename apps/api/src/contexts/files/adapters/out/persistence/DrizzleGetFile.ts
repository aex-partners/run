import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { files } from '@/platform/db/schema'
import { GetFile, FileDetail } from '@/contexts/files/application/queries/GetFile'
import { formatFileSize } from '@/contexts/files/domain/FileType'
import { isFileSource } from '@/contexts/files/domain/FileSource'

// Read-side adapter (CQRS) for `files.getById`.
export class DrizzleGetFile implements GetFile {
  constructor(private readonly db: Database) {}

  async execute(input: { id: string }): Promise<FileDetail | null> {
    const [row] = await this.db.select().from(files).where(eq(files.id, input.id)).limit(1)
    if (!row) return null

    const isFolder = row.isFolder === 1
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      mimeType: row.mimeType,
      size: formatFileSize(row.size),
      source: isFileSource(row.source) ? row.source : 'upload',
      sourceRef: row.sourceRef,
      parentId: row.parentId,
      isFolder,
      starred: row.starred === 1,
      aiIndexed: row.aiIndexed === 1,
      publicToken: row.publicToken,
      ownerId: row.ownerId,
      previewUrl: isFolder ? null : `/api/files/${row.id}/raw`,
      downloadUrl: isFolder ? null : `/api/files/${row.id}/raw?download=1`,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
