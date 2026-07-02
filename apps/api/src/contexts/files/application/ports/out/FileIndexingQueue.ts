// ACL / driven port. Triggers (or revokes) AI indexing for a file. The files
// context owns no embeddings; this is an anti-corruption boundary toward the
// future knowledge context — main bridges it to knowledge's indexing in-port
// (today an adapter just enqueues a BullMQ job, mirroring AEX's
// file-indexing-queue).
export interface FileIndexingRequest {
  fileId: string
  ownerId: string
  action: 'index' | 'deindex'
}

export interface FileIndexingQueue {
  enqueue(request: FileIndexingRequest): Promise<void>
}
