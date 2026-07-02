import { and, desc, eq, ilike, isNotNull, isNull, or, sql, SQL } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { files } from '@/platform/db/schema'
import { ListFiles, ListFilesOptions, FileListItem } from '@/contexts/files/application/queries/ListFiles'
import { formatFileSize } from '@/contexts/files/domain/FileType'
import { isFileSource } from '@/contexts/files/domain/FileSource'

// Read-side adapter (CQRS). Ports the AEX `files.list` query 1:1: owner-scoped,
// category/source filtered, searchable, paginated, then shaped into the view
// model the screen consumes.
export class DrizzleListFiles implements ListFiles {
  constructor(private readonly db: Database) {}

  async execute(opts: ListFilesOptions): Promise<FileListItem[]> {
    const conditions: SQL[] = []

    if (opts.category === 'trash') {
      conditions.push(isNotNull(files.deletedAt))
    } else {
      conditions.push(isNull(files.deletedAt))

      if (opts.category === 'starred') {
        conditions.push(eq(files.starred, 1))
      } else if (opts.category === 'shared') {
        const shared = or(
          isNotNull(files.publicToken),
          sql`EXISTS (SELECT 1 FROM file_shares WHERE file_shares.file_id = files.id)`,
        )
        if (shared) conditions.push(shared)
      } else if (opts.category === 'recent') {
        // No extra filter; ordering by updatedAt handles "recent".
      } else if (opts.parentId !== undefined) {
        conditions.push(opts.parentId === null ? isNull(files.parentId) : eq(files.parentId, opts.parentId))
      }
    }

    if (opts.source !== 'all') {
      conditions.push(eq(files.source, opts.source))
    }

    if (opts.search) {
      conditions.push(ilike(files.name, `%${opts.search}%`))
    }

    conditions.push(eq(files.ownerId, opts.ownerId))

    const where = conditions.length === 1 ? conditions[0] : and(...conditions)

    const rows = await this.db
      .select()
      .from(files)
      .where(where)
      .orderBy(desc(files.isFolder), desc(files.updatedAt))
      .limit(opts.limit)
      .offset(opts.offset)

    return rows.map((row): FileListItem => {
      const isFolder = row.isFolder === 1
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        size: formatFileSize(row.size),
        modifiedAt: formatDate(row.updatedAt),
        source: isFileSource(row.source) ? row.source : 'upload',
        sourceRef: row.sourceRef,
        starred: row.starred === 1,
        shared: row.publicToken !== null,
        isFolder,
        parentId: row.parentId,
        aiIndexed: row.aiIndexed === 1,
        previewUrl: isFolder ? null : `/api/files/${row.id}/raw`,
        downloadUrl: isFolder ? null : `/api/files/${row.id}/raw?download=1`,
      }
    })
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
