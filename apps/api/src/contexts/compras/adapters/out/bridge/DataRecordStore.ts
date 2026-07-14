import { Cond, RecordRow, RecordStore } from '@/contexts/compras/application/ports/out/RecordStore'
import { ResolveOwner } from '@/contexts/compras/application/ports/out/ResolveOwner'

// Local shapes for the data ListEntities/QueryRecords/GetRecord/InsertRecord/
// UpdateRecord/DeleteRecord in-ports this bridge calls. Structurally identical
// to the slice of those ports this adapter uses -- kept local (not imported)
// so this adapter never crosses the context boundary at the type level; the
// concrete data in-ports injected by main/wiring/compras.ts satisfy these
// shapes structurally.
// `createdBy` mirrors data's InsertRecordCommand.createdBy (optional there);
// this bridge always resolves an owner id before inserting, so it always
// supplies one -- see insert() below.
interface EntityRow { id: string; slug: string }
interface ListEntitiesLike { execute(): Promise<EntityRow[]> }
interface QueryRecordsLike {
  execute(spec: {
    entity: string
    where?: { field: string; op: string; value?: unknown; values?: unknown[] }[]
    limit?: number
  }): Promise<{ entity: string; rows?: RecordRow[] }>
}
interface GetRecordLike { execute(q: { recordId: string }): Promise<RecordRow | null> }
interface InsertRecordLike {
  execute(cmd: { entityId: string; data: Record<string, unknown>; createdBy?: string }): Promise<{ ok: boolean; value?: { id: string }; error?: string }>
}
interface UpdateRecordLike {
  execute(cmd: { recordId: string; data: Record<string, unknown>; expectedVersion: number }): Promise<{ ok: boolean; error?: string }>
}
interface DeleteRecordLike {
  execute(cmd: { recordId: string }): Promise<{ ok: boolean; error?: string }>
}

export interface DataRecordStoreDeps {
  listEntities: ListEntitiesLike
  query: QueryRecordsLike
  get: GetRecordLike
  insert: InsertRecordLike
  update: UpdateRecordLike
  delete: DeleteRecordLike
  resolveOwner: ResolveOwner
}

// ACL bridge: compras RecordStore -> data ListEntities/QueryRecords/GetRecord/
// InsertRecord/UpdateRecord/DeleteRecord. Manufacturing's RecordStore is keyed by
// entityId; the data QueryRecords in-port is keyed by entity slug, so this
// bridge resolves entityId -> slug via ListEntities before every query.
export class DataRecordStore implements RecordStore {
  constructor(private readonly deps: DataRecordStoreDeps) {}

  private async slugOf(entityId: string): Promise<string> {
    const e = (await this.deps.listEntities.execute()).find((x) => x.id === entityId)
    if (!e) throw new Error(`entity id not found: ${entityId}`)
    return e.slug
  }

  // `limit` repassado ao QueryRecords do data: sem ele o engine trunca em 50 (teto 500),
  // ORDER BY created_at DESC, descartando as linhas MAIS ANTIGAS sem erro nenhum.
  async query(entityId: string, where: Cond[], limit?: number): Promise<RecordRow[]> {
    const entity = await this.slugOf(entityId)
    const res = await this.deps.query.execute({
      entity,
      where: where.map((c) => ({ field: c.field, op: c.op, value: c.value, values: c.values })),
      limit,
    })
    return res.rows ?? []
  }

  async get(recordId: string): Promise<RecordRow | null> {
    return this.deps.get.execute({ recordId })
  }

  async insert(entityId: string, data: Record<string, unknown>): Promise<string> {
    const createdBy = await this.deps.resolveOwner.ownerId()
    if (!createdBy) throw new Error('nenhum usuário owner: não é possível gravar registros')
    const r = await this.deps.insert.execute({ entityId, data, createdBy })
    if (!r.ok || !r.value) throw new Error(r.error ?? 'insert failed')
    return r.value.id
  }

  async update(recordId: string, data: Record<string, unknown>, expectedVersion: number): Promise<void> {
    const r = await this.deps.update.execute({ recordId, data, expectedVersion })
    if (!r.ok) throw new Error(r.error ?? 'update failed')
  }

  async delete(recordId: string): Promise<void> {
    const r = await this.deps.delete.execute({ recordId })
    if (!r.ok) throw new Error(r.error ?? 'delete failed')
  }
}
