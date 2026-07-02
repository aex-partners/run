// Read side (CQRS). One aggregate query feeding the sidebar badge counts for the
// `files.categoryCounts` procedure.
export interface CategoryCountsResult {
  all: number
  starred: number
  recent: number
  shared: number
  trash: number
}

export interface CategoryCounts {
  execute(input: { ownerId: string }): Promise<CategoryCountsResult>
}
