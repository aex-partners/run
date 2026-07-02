// Wiring for the `geocode` context. Self-contained: a Nominatim provider behind a
// Drizzle-backed cache. No cross-context dependencies.
import { Infra } from '@/main/wiring/infra'

import { NominatimProvider } from '@/contexts/geocode/adapters/out/http/NominatimProvider'
import { DrizzleGeocodeCacheRepository } from '@/contexts/geocode/adapters/out/persistence/DrizzleGeocodeCacheRepository'
import { GeocodeService } from '@/contexts/geocode/application/use-cases/GeocodeService'
import { geocodeController } from '@/contexts/geocode/adapters/in/http/GeocodeController'

export function wireGeocode(infra: Infra) {
  const { db } = infra
  const geocodeCacheRepo = new DrizzleGeocodeCacheRepository(db)
  const geocodeProvider = new NominatimProvider()
  const geocode = new GeocodeService(geocodeCacheRepo, geocodeProvider)
  const geocodeCtl = geocodeController({ geocode })
  return { controller: geocodeCtl }
}
