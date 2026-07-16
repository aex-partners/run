export interface RecordRow { id: string; version: number; data: Record<string, unknown> }
export interface Cond { field: string; op: 'eq' | 'in'; value?: unknown; values?: unknown[] }
export interface RecordStore {
  // `limit` chega ao query engine do contexto `data`, que aplica `Math.min(limit ?? 50, 500)`
  // com ORDER BY created_at DESC (ver data/adapters/out/persistence/DrizzleQueryRecords).
  // Ou seja: OMITIR o limite trunca em 50 linhas e descarta SILENCIOSAMENTE as MAIS ANTIGAS.
  // Toda leitura que precisa do conjunto COMPLETO deve passar limite explícito (500 = o teto).
  query(entityId: string, where: Cond[], limit?: number): Promise<RecordRow[]>
  get(recordId: string): Promise<RecordRow | null>
  insert(entityId: string, data: Record<string, unknown>): Promise<string>
  update(recordId: string, data: Record<string, unknown>, expectedVersion: number): Promise<void>
  delete(recordId: string): Promise<void>
}
