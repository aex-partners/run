import { Result } from '@/shared/kernel/Result'
import { FileSource } from '@/contexts/files/domain/FileSource'

// Driving port behind the Fastify /api/upload/file route. Bytes in, metadata out
// — the storage path is an internal detail the adapter never has to compute.
// `bytes` is a Uint8Array (Buffer is one) so the boundary stays free of node
// types.
export interface UploadFileCommand {
  ownerId: string
  name: string
  bytes: Uint8Array
  parentId?: string | null
  source?: FileSource
  sourceRef?: string | null
}

export interface UploadFileResult {
  id: string
  name: string
  type: string
  mimeType: string | null
  size: number
  path: string
}

export interface UploadFile {
  execute(cmd: UploadFileCommand): Promise<Result<UploadFileResult>>
}
