import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { geocodeCache } from '@/platform/db/schema'
import { GeocodeCacheRepository } from '@/contexts/geocode/application/ports/out/GeocodeCacheRepository'
import { GeoPoint } from '@/contexts/geocode/domain/GeoPoint'
import { CachedCoords } from '@/contexts/geocode/domain/geocode'

// Driven adapter. Backs the read-through cache with the `geocode_cache` table.
export class DrizzleGeocodeCacheRepository implements GeocodeCacheRepository {
  constructor(private readonly db: Database) {}

  async find(query: string): Promise<CachedCoords | null> {
    const [row] = await this.db
      .select({ lat: geocodeCache.lat, lng: geocodeCache.lng })
      .from(geocodeCache)
      .where(eq(geocodeCache.query, query))
      .limit(1)
    return row ? { lat: row.lat, lng: row.lng } : null
  }

  async save(query: string, point: GeoPoint | null): Promise<void> {
    await this.db
      .insert(geocodeCache)
      .values({ query, lat: point?.lat ?? null, lng: point?.lng ?? null })
      .onConflictDoNothing()
  }
}
