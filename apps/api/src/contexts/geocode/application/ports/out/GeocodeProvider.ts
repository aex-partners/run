import { GeoPoint } from '@/contexts/geocode/domain/GeoPoint'

// ACL out-port wrapping the external geocoding provider (Nominatim). Returns null
// when the address can't be resolved. All HTTP, rate-limiting and provider quirks
// live in the adapter; the application sees only this port.
export interface GeocodeProvider {
  lookup(query: string): Promise<GeoPoint | null>
}
