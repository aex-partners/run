// ACL out-port wrapping the external Bling API v3 for the full-mirror sync.
// Distinct from BlingClient (the per-resource ACL used by the read-through
// use-cases): this port is shaped for bulk export -- paginating an entire
// resource and fetching single records by relative path, both already scoped
// to the resolved OAuth2 token by the adapter.
export interface BlingSyncClient {
  // Iterate every page of a Bling list endpoint, yielding one item at a time.
  paginate<T>(path: string): AsyncIterable<T>

  // Fetch a single resource by path (e.g. detail lookups during sync).
  get<T>(path: string): Promise<T>
}
