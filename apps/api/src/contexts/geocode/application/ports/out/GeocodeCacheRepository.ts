import { GeoPoint } from '@/contexts/geocode/domain/GeoPoint'
import { CachedCoords } from '@/contexts/geocode/domain/geocode'

// Driven port. Backed by the `geocode_cache` table keyed on the normalized query.
export interface GeocodeCacheRepository {
  // null = no row at all (cache miss); a row with null coords = recorded miss.
  find(query: string): Promise<CachedCoords | null>
  // Persist a hit or a recorded miss (point=null). No-op if a row already exists.
  save(query: string, point: GeoPoint | null): Promise<void>
}
