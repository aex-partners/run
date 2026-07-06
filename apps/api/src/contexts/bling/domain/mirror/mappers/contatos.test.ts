import { describe, it, expect } from 'vitest'
import { mapContato } from '@/contexts/bling/domain/mirror/mappers/contatos'

describe('mapContato', () => {
  it('emits contato first, then pessoas + tipos_assigned referencing it', () => {
    const out = mapContato({
      id: 10, nome: 'ACME', email: 'a@b.com',
      endereco: { geral: { municipio: 'SP' } },
      pessoasContato: [{ id: 99, nome: 'Fulano' }],
      tiposContato: [{ id: 3, descricao: 'Cliente' }],
    } as never)
    expect(out[0].slug).toBe('bling_contatos')
    expect(out[0].externalId).toBe('10')
    expect(out[0].data).toMatchObject({ nome: 'ACME', email: 'a@b.com', endereco_geral: { municipio: 'SP' } })
    const pessoa = out.find((r) => r.slug === 'bling_pessoas_contato')!
    expect(pessoa.externalId).toBe('99')
    expect(pessoa.data.contato).toEqual({ __rel: true, slug: 'bling_contatos', externalId: '10' })
    const assign = out.find((r) => r.slug === 'bling_contato_tipos_assigned')!
    expect(assign.externalId).toBe('10:3')
    expect(assign.data.tipo).toEqual({ __rel: true, slug: 'bling_tipos_contato', externalId: '3' })
  })
})
