import { describe, it, expect } from 'vitest'
import { FkCache } from '@/contexts/bling/application/mirror/FkCache'

describe('FkCache', () => {
  it('sets and looks up by slug+externalId, null when absent or zero', () => {
    const fk = new FkCache()
    fk.set('bling_produtos', '1', 'rec-1')
    expect(fk.lookup('bling_produtos', '1')).toBe('rec-1')
    expect(fk.lookup('bling_produtos', '2')).toBeNull()
    expect(fk.lookup('bling_contatos', '1')).toBeNull()
  })
  it('hydrateFrom bulk-loads rows', () => {
    const fk = new FkCache()
    fk.hydrateFrom([{ entitySlug: 'bling_contatos', externalId: '9', recordId: 'r9' }])
    expect(fk.lookup('bling_contatos', '9')).toBe('r9')
  })
})
