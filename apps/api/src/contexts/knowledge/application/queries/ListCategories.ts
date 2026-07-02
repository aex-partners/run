// Read port (CQRS). Distinct categories in use, excluding the reserved
// file-content bucket.
export interface ListCategories {
  execute(): Promise<string[]>
}
