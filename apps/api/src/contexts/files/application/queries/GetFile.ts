import { FileSource } from '@/contexts/files/domain/FileSource'

// Read side (CQRS). Single-file detail view for the `files.getById` procedure.
export interface FileDetail {
  id: string
  name: string
  type: string
  mimeType: string | null
  size: string
  source: FileSource
  sourceRef: string | null
  parentId: string | null
  isFolder: boolean
  starred: boolean
  aiIndexed: boolean
  publicToken: string | null
  ownerId: string
  previewUrl: string | null
  downloadUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface GetFile {
  execute(input: { id: string }): Promise<FileDetail | null>
}
