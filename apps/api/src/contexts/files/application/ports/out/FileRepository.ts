import { File } from '@/contexts/files/domain/File'
import { FileId } from '@/contexts/files/domain/ids'

// Driven port. States WHAT the application needs from persistence; an adapter
// under adapters/out implements HOW (Drizzle/Postgres, in-memory, ...).
export interface FileRepository {
  nextId(): FileId
  // Mints an unguessable public-share token (UUID in the Drizzle adapter).
  nextPublicToken(): string
  findById(id: FileId): Promise<File | null>
  save(file: File): Promise<void>
  delete(file: File): Promise<void>
  // Backs emptyTrash: every soft-deleted file owned by the user.
  findTrashedByOwner(ownerId: string): Promise<File[]>
}
