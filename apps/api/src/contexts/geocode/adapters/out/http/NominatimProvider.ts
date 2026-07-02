import { GeocodeProvider } from '@/contexts/geocode/application/ports/out/GeocodeProvider'
import { GeoPoint } from '@/contexts/geocode/domain/GeoPoint'

// ACL adapter for OpenStreetMap Nominatim. Usage policy: max 1 req/s, identify
// with a real User-Agent + contact. Outbound calls are serialized through a
// single per-instance promise chain and spaced by >= MIN_INTERVAL_MS so
// concurrent requests can never fire two calls in the same second. Cache hits
// never reach here.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'AEX-ERP/1.0 (andre@aex.partners)'
const MIN_INTERVAL_MS = 1000

export class NominatimProvider implements GeocodeProvider {
  private chain: Promise<unknown> = Promise.resolve()
  private lastCallAt = 0

  lookup(query: string): Promise<GeoPoint | null> {
    const run = this.chain.then(async () => {
      const wait = MIN_INTERVAL_MS - (Date.now() - this.lastCallAt)
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      this.lastCallAt = Date.now()
      return this.fetchNominatim(query)
    })
    // Keep the chain alive regardless of this call's outcome.
    this.chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private async fetchNominatim(query: string): Promise<GeoPoint | null> {
    const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
    if (!Array.isArray(data) || data.length === 0) return null
    const first = data[0]
    const lat = Number.parseFloat(String(first?.lat ?? ''))
    const lng = Number.parseFloat(String(first?.lon ?? ''))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  }
}
