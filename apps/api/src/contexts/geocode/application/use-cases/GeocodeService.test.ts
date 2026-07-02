import { describe, it, expect } from 'vitest'
import { GeocodeService } from '@/contexts/geocode/application/use-cases/GeocodeService'
import { GeocodeCacheRepository } from '@/contexts/geocode/application/ports/out/GeocodeCacheRepository'
import { GeocodeProvider } from '@/contexts/geocode/application/ports/out/GeocodeProvider'
import { GeoPoint } from '@/contexts/geocode/domain/GeoPoint'
import { CachedCoords } from '@/contexts/geocode/domain/geocode'

class FakeCache implements GeocodeCacheRepository {
  saved: { query: string; point: GeoPoint | null }[] = []
  lookedUp: string[] = []
  constructor(private readonly rows: Map<string, CachedCoords>) {}
  async find(query: string): Promise<CachedCoords | null> {
    this.lookedUp.push(query)
    return this.rows.get(query) ?? null
  }
  async save(query: string, point: GeoPoint | null): Promise<void> {
    this.saved.push({ query, point })
  }
}

class FakeProvider implements GeocodeProvider {
  calls: string[] = []
  constructor(private readonly result: GeoPoint | null) {}
  async lookup(query: string): Promise<GeoPoint | null> {
    this.calls.push(query)
    return this.result
  }
}

describe('GeocodeService', () => {
  it('returns null for a blank address without hitting cache or provider', async () => {
    const cache = new FakeCache(new Map())
    const provider = new FakeProvider(null)
    const svc = new GeocodeService(cache, provider)
    expect(await svc.execute({ address: '   ' })).toBeNull()
    expect(cache.lookedUp).toHaveLength(0)
    expect(provider.calls).toHaveLength(0)
  })

  it('serves a cache hit by normalized key without calling the provider', async () => {
    const cache = new FakeCache(new Map([['rua augusta, 100', { lat: -23.5, lng: -46.6 }]]))
    const provider = new FakeProvider(null)
    const svc = new GeocodeService(cache, provider)
    const point = await svc.execute({ address: '  Rua  Augusta, 100 ' })
    expect(point).toEqual({ lat: -23.5, lng: -46.6 })
    expect(cache.lookedUp).toEqual(['rua augusta, 100'])
    expect(provider.calls).toHaveLength(0)
  })

  it('serves a recorded miss (row with null coords) as null without calling provider', async () => {
    const cache = new FakeCache(new Map([['nowhere', { lat: null, lng: null }]]))
    const provider = new FakeProvider({ lat: 1, lng: 2 })
    const svc = new GeocodeService(cache, provider)
    expect(await svc.execute({ address: 'Nowhere' })).toBeNull()
    expect(provider.calls).toHaveLength(0)
  })

  it('on a cache miss, calls the provider and caches the hit', async () => {
    const cache = new FakeCache(new Map())
    const provider = new FakeProvider({ lat: 10, lng: 20 })
    const svc = new GeocodeService(cache, provider)
    const point = await svc.execute({ address: 'New Place' })
    expect(point).toEqual({ lat: 10, lng: 20 })
    expect(provider.calls).toEqual(['new place'])
    expect(cache.saved).toEqual([{ query: 'new place', point: { lat: 10, lng: 20 } }])
  })

  it('caches a provider miss (null) so it is not re-queried', async () => {
    const cache = new FakeCache(new Map())
    const provider = new FakeProvider(null)
    const svc = new GeocodeService(cache, provider)
    expect(await svc.execute({ address: 'Unresolvable' })).toBeNull()
    expect(cache.saved).toEqual([{ query: 'unresolvable', point: null }])
  })
})
