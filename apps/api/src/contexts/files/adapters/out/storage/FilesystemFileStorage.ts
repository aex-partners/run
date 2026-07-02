import { writeFile, readFile, unlink, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { FileStorage } from '@/contexts/files/application/ports/out/FileStorage'

// Driven adapter for the FileStorage port. Ported from AEX files/storage.ts:
// content lives under <uploadsDir>/files with a random, extension-preserving
// name; the returned relative path is what the File aggregate persists. The base
// directory is injected (main reads FILE_STORAGE_PATH) so the adapter stays
// process-env-free and testable. Swapping to S3/GCS means a new adapter, nothing
// above it changes.
export class FilesystemFileStorage implements FileStorage {
  private readonly filesDir: string

  constructor(private readonly uploadsDir: string) {
    this.filesDir = resolve(uploadsDir, 'files')
  }

  async save(bytes: Uint8Array, filename: string): Promise<string> {
    await mkdir(this.filesDir, { recursive: true })
    const ext = extname(filename) || ''
    const storedName = `${randomUUID()}${ext}`
    const relativePath = `files/${storedName}`
    await writeFile(resolve(this.uploadsDir, relativePath), bytes)
    return relativePath
  }

  async read(relativePath: string): Promise<Uint8Array> {
    return readFile(resolve(this.uploadsDir, relativePath))
  }

  async delete(relativePath: string): Promise<void> {
    try {
      await unlink(resolve(this.uploadsDir, relativePath))
    } catch {
      // Already gone — deletion is idempotent.
    }
  }
}
