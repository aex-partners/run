export interface RecordRow { id: string; version: number; data: Record<string, unknown> }
export interface Cond { field: string; op: 'eq' | 'in'; value?: unknown; values?: unknown[] }
export interface RecordStore {
  query(entityId: string, where: Cond[]): Promise<RecordRow[]>
  get(recordId: string): Promise<RecordRow | null>
  insert(entityId: string, data: Record<string, unknown>): Promise<string>
  update(recordId: string, data: Record<string, unknown>, expectedVersion: number): Promise<void>
}
