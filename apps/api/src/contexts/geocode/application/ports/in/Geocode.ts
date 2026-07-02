import { GeoPoint } from '@/contexts/geocode/domain/GeoPoint'

// Driving port. Read-through geocoder: returns coordinates, or null when the
// address cannot be resolved (a result the cache also remembers).
export interface GeocodeQuery {
  address: string
}

export interface Geocode {
  execute(query: GeocodeQuery): Promise<GeoPoint | null>
}
