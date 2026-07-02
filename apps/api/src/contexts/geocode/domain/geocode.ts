import { GeoPoint } from '@/contexts/geocode/domain/GeoPoint'

// Normalize a free-text address so equivalent queries share one cache row.
export function normalizeQuery(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase()
}

// A cache row stores null coords to record a *confirmed miss* (an address that
// resolved to nothing), so unresolvable addresses are never re-queried.
export interface CachedCoords {
  lat: number | null
  lng: number | null
}

// Read a stored row's coords back into a point, or null for a recorded miss.
export function pointFromCache(row: CachedCoords): GeoPoint | null {
  return row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : null
}
