import { describe, it, expect } from 'vitest'
import { CredentialMapper, CredentialRow } from '@/contexts/credentials/application/mappers/CredentialMapper'
import { Credential } from '@/contexts/credentials/domain/Credential'
import { CredentialId } from '@/contexts/credentials/domain/ids'
import { CredentialType } from '@/contexts/credentials/domain/CredentialType'
import { CredentialStatus } from '@/contexts/credentials/domain/CredentialStatus'

const baseRow = (over: Partial<CredentialRow> = {}): CredentialRow => ({
  id: 'cred-1',
  name: 'My Cred',
  pluginName: 'erp',
  type: 'secret_text',
  status: 'active',
  isPrimary: false,
  value: { token: 'abc', nested: { a: 1, b: [true, null, 'x'] } },
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...over,
})

describe('CredentialMapper round-trip (toPersistence <-> toDomain)', () => {
  it('toDomain then toPersistence reproduces the original row, preserving the nested JsonObject value', () => {
    const row = baseRow()
    const back = CredentialMapper.toPersistence(CredentialMapper.toDomain(row))
    expect(back).toEqual(row)
  })

  it('preserves isPrimary in both states', () => {
    for (const isPrimary of [true, false]) {
      const row = baseRow({ isPrimary })
      expect(CredentialMapper.toPersistence(CredentialMapper.toDomain(row)).isPrimary).toBe(isPrimary)
    }
  })

  it('preserves every status variant', () => {
    const statuses: CredentialStatus[] = ['active', 'error', 'missing']
    for (const status of statuses) {
      const row = baseRow({ status })
      expect(CredentialMapper.toPersistence(CredentialMapper.toDomain(row)).status).toBe(status)
    }
  })

  it('preserves every type variant', () => {
    const types: CredentialType[] = ['oauth2', 'secret_text', 'basic_auth', 'custom_auth']
    for (const type of types) {
      const row = baseRow({ type })
      expect(CredentialMapper.toPersistence(CredentialMapper.toDomain(row)).type).toBe(type)
    }
  })

  it('preserves createdBy when null', () => {
    const row = baseRow({ createdBy: null })
    const back = CredentialMapper.toPersistence(CredentialMapper.toDomain(row))
    expect(back.createdBy).toBeNull()
    expect(back).toEqual(row)
  })

  it('preserves createdBy when set', () => {
    const row = baseRow({ createdBy: 'someone' })
    expect(CredentialMapper.toPersistence(CredentialMapper.toDomain(row)).createdBy).toBe('someone')
  })

  it('keeps createdAt/updatedAt as distinct Date instances with the original values', () => {
    const row = baseRow()
    const back = CredentialMapper.toPersistence(CredentialMapper.toDomain(row))
    expect(back.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'))
    expect(back.updatedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'))
  })

  it('toPersistence projects a freshly created aggregate to its row shape', () => {
    const created = Credential.create({
      id: CredentialId.of('cred-9'),
      name: 'Fresh',
      pluginName: 'gmail',
      type: 'oauth2',
      value: { access_token: 'AT' },
      isPrimary: true,
      createdBy: 'user-7',
      now: new Date('2026-03-03T03:03:03.000Z'),
    })
    if (!created.ok) throw new Error(created.error)

    const row = CredentialMapper.toPersistence(created.value)
    expect(row).toEqual({
      id: 'cred-9',
      name: 'Fresh',
      pluginName: 'gmail',
      type: 'oauth2',
      status: 'active',
      isPrimary: true,
      value: { access_token: 'AT' },
      createdBy: 'user-7',
      createdAt: new Date('2026-03-03T03:03:03.000Z'),
      updatedAt: new Date('2026-03-03T03:03:03.000Z'),
    })
  })
})
