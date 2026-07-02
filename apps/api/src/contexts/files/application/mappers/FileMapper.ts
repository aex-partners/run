import { File } from '@/contexts/files/domain/File'
import { FileId } from '@/contexts/files/domain/ids'
import { FileSource, isFileSource } from '@/contexts/files/domain/FileSource'

// Mirrors the AEX `files` table. Booleans live as 0/1 integers on disk; the
// mapper is the only place that knows that. The on-disk shape never leaks past
// this boundary.
export interface FileRow {
  id: string
  name: string
  type: string
  mimeType: string | null
  size: number
  path: string | null
  source: string
  sourceRef: string | null
  parentId: string | null
  isFolder: number
  starred: number
  aiIndexed: number
  publicToken: string | null
  deletedAt: Date | null
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

// The column set written on insert/upsert (id included; createdAt is DB-defaulted).
export interface FileValues {
  id: string
  name: string
  type: string
  mimeType: string | null
  size: number
  path: string | null
  source: FileSource
  sourceRef: string | null
  parentId: string | null
  isFolder: number
  starred: number
  aiIndexed: number
  publicToken: string | null
  deletedAt: Date | null
  ownerId: string
  updatedAt: Date
}

export const FileMapper = {
  toValues(file: File): FileValues {
    return {
      id: file.id.value,
      name: file.name,
      type: file.type,
      mimeType: file.mimeType,
      size: file.size,
      path: file.path,
      source: file.source,
      sourceRef: file.sourceRef,
      parentId: file.parentId ? file.parentId.value : null,
      isFolder: file.isFolder ? 1 : 0,
      starred: file.starred ? 1 : 0,
      aiIndexed: file.aiIndexed ? 1 : 0,
      publicToken: file.publicToken,
      deletedAt: file.deletedAt,
      ownerId: file.ownerId,
      updatedAt: file.updatedAt,
    }
  },

  toDomain(row: FileRow): File {
    return File.rehydrate(FileId.of(row.id), {
      name: row.name,
      type: row.type,
      mimeType: row.mimeType,
      size: row.size,
      path: row.path,
      source: isFileSource(row.source) ? row.source : 'upload',
      sourceRef: row.sourceRef,
      parentId: row.parentId,
      isFolder: row.isFolder === 1,
      starred: row.starred === 1,
      aiIndexed: row.aiIndexed === 1,
      publicToken: row.publicToken,
      deletedAt: row.deletedAt,
      ownerId: row.ownerId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  },
}
