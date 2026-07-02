// Read side. Ports entities.pivotData: lean extraction of just the requested
// field slugs for EVERY record of an entity, capped, so the client aggregates
// over the full dataset locally (locale-aware numeric parsing).
export interface PivotRecordsOptions {
  entityId: string
  fields: string[]
}

export interface PivotResult {
  rows: { [slug: string]: string | null }[]
  total: number
  truncated: boolean
}

export interface PivotRecords {
  execute(opts: PivotRecordsOptions): Promise<PivotResult>
}
