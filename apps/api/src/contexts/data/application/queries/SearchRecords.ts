// Read side. Ports entities.searchRecords: label-based fuzzy search used by the
// relationship picker. Returns { id, label } pairs.
export interface SearchRecordsOptions {
  entityId: string
  search?: string
  limit?: number
}

export interface RecordLabel {
  id: string
  label: string
}

export interface SearchRecords {
  execute(opts: SearchRecordsOptions): Promise<RecordLabel[]>
}
