import { Geocode, GeocodeQuery } from '@/contexts/geocode/application/ports/in/Geocode'
import { GeocodeCacheRepository } from '@/contexts/geocode/application/ports/out/GeocodeCacheRepository'
import { GeocodeProvider } from '@/contexts/geocode/application/ports/out/GeocodeProvider'
import { GeoPoint } from '@/contexts/geocode/domain/GeoPoint'
import { normalizeQuery, pointFromCache } from '@/contexts/geocode/domain/geocode'

// Read-through cache: normalize the address, serve from cache, otherwise call the
// provider and cache the result — including a miss (null) so unresolvable
// addresses aren't re-queried.
export class GeocodeService implements Geocode {
  constructor(
    private readonly cache: GeocodeCacheRepository,
    private readonly provider: GeocodeProvider,
  ) {}

  async execute(query: GeocodeQuery): Promise<GeoPoint | null> {
    const normalized = normalizeQuery(query.address)
    if (!normalized) return null

    const cached = await this.cache.find(normalized)
    if (cached) return pointFromCache(cached)

    const point = await this.provider.lookup(normalized)
    await this.cache.save(normalized, point)
    return point
  }
}
