import { describe, it, expect } from 'vitest'
import { GetOAuthConfigService } from '@/contexts/plugins/application/use-cases/GetOAuthConfigService'
import { PieceRegistry, PieceCatalogEntry } from '@/contexts/plugins/application/ports/out/PieceRegistry'
import { PieceMetadata } from '@/contexts/plugins/domain/PieceMetadata'

function entry(over: Partial<PieceCatalogEntry> = {}): PieceCatalogEntry {
  return {
    id: 'cat-1',
    name: 'Gmail',
    description: null,
    version: '1.0.0',
    category: null,
    pieceName: 'piece-gmail',
    authType: 'oauth2',
    authProps: [],
    icon: null,
    source: 'piece',
    manifest: null,
    raw: {
      auth: {
        authUrl: 'https://accounts.google.com/o/oauth2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: ['https://mail.google.com/', 'profile'],
        tokenAuthMethod: 'body',
      },
    },
    ...over,
  }
}

function fakeRegistry(entries: PieceCatalogEntry[]): PieceRegistry {
  return {
    async loadMetadata(): Promise<PieceMetadata | null> {
      return null
    },
    async listCatalog(): Promise<PieceCatalogEntry[]> {
      return entries
    },
  }
}

describe('GetOAuthConfigService', () => {
  it('fails when pieceName is missing', async () => {
    const svc = new GetOAuthConfigService(fakeRegistry([entry()]))
    const r = await svc.execute({ pieceName: '' })
    expect(r.ok).toBe(false)
  })

  it('resolves null when the piece is not in the catalog', async () => {
    const svc = new GetOAuthConfigService(fakeRegistry([entry()]))
    const r = await svc.execute({ pieceName: 'piece-unknown' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBeNull()
  })

  it('resolves null when the piece is not an oauth2 piece', async () => {
    const svc = new GetOAuthConfigService(fakeRegistry([entry({ authType: 'secret_text' })]))
    const r = await svc.execute({ pieceName: 'piece-gmail' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBeNull()
  })

  it('resolves null when authUrl/tokenUrl are missing', async () => {
    const svc = new GetOAuthConfigService(fakeRegistry([entry({ raw: { auth: { scope: 'x' } } })]))
    const r = await svc.execute({ pieceName: 'piece-gmail' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBeNull()
  })

  it('projects the auth props, collapsing a scope array to a space-delimited string', async () => {
    const svc = new GetOAuthConfigService(fakeRegistry([entry()]))
    const r = await svc.execute({ pieceName: 'piece-gmail' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toEqual({
        authUrl: 'https://accounts.google.com/o/oauth2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: 'https://mail.google.com/ profile',
        tokenAuthMethod: 'body',
        displayName: 'Gmail',
      })
    }
  })
})
