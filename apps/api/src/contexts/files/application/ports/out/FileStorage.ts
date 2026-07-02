// Driven port for the bytes. The application stores/reads/deletes file content
// without knowing it is a local filesystem — a future S3/GCS adapter swaps in
// without touching a use case. Returns/accepts Uint8Array to stay free of node
// types. The relative path it returns is what gets persisted on the File.
export interface FileStorage {
  save(bytes: Uint8Array, filename: string): Promise<string>
  read(relativePath: string): Promise<Uint8Array>
  delete(relativePath: string): Promise<void>
}
