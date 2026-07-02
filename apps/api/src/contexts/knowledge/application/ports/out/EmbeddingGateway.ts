// ACL / driven port. Turns text into a dense vector via an external embedding
// model (AEX uses Voyage `voyage-3`). Best-effort: returns null on failure so
// callers can fall back to text search instead of failing the operation.
// `document` vs `query` mirror the model's asymmetric input types.
export interface EmbeddingGateway {
  embedDocument(text: string): Promise<number[] | null>
  embedQuery(text: string): Promise<number[] | null>
}
