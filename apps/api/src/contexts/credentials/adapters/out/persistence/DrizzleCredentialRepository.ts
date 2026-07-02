import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { credentials } from '@/platform/db/schema'
import { JsonObject } from '@/shared/domain/Json'
import { CredentialRepository } from '@/contexts/credentials/application/ports/out/CredentialRepository'
import { Cipher } from '@/contexts/credentials/application/ports/out/Cipher'
import { CredentialMapper } from '@/contexts/credentials/application/mappers/CredentialMapper'
import { Credential } from '@/contexts/credentials/domain/Credential'
import { CredentialId } from '@/contexts/credentials/domain/ids'
import { CredentialCandidate } from '@/contexts/credentials/domain/CredentialResolution'

// Driven adapter. Stores the aggregate in the `credentials` table and OWNS the
// encryption boundary: the value column is AES-encrypted via the Cipher port on
// write and tolerantly decrypted on read (encrypted JSON first, then a plain-JSON
// fallback for legacy rows, then `{}`), mirroring the source `decryptCredentials`.
export class DrizzleCredentialRepository implements CredentialRepository {
  constructor(
    private readonly db: Database,
    private readonly cipher: Cipher,
  ) {}

  nextId(): CredentialId {
    return CredentialId.of(randomUUID())
  }

  async findById(id: CredentialId): Promise<Credential | null> {
    const [row] = await this.db.select().from(credentials).where(eq(credentials.id, id.value)).limit(1)
    if (!row) return null
    return CredentialMapper.toDomain({
      id: row.id,
      name: row.name,
      pluginName: row.pluginName,
      type: row.type,
      status: row.status,
      isPrimary: row.isPrimary,
      value: this.decryptValue(row.value),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  async findActiveCandidatesByPlugin(pluginName: string): Promise<CredentialCandidate[]> {
    const rows = await this.db
      .select({
        id: credentials.id,
        isPrimary: credentials.isPrimary,
        createdAt: credentials.createdAt,
        status: credentials.status,
      })
      .from(credentials)
      .where(and(eq(credentials.pluginName, pluginName), eq(credentials.status, 'active')))
      .orderBy(desc(credentials.isPrimary), asc(credentials.createdAt))

    return rows.map((r) => ({
      id: r.id,
      isPrimary: r.isPrimary,
      createdAt: r.createdAt,
      status: r.status,
    }))
  }

  async listOAuth2Ids(): Promise<string[]> {
    const rows = await this.db
      .select({ id: credentials.id })
      .from(credentials)
      .where(eq(credentials.type, 'oauth2'))
    return rows.map((r) => r.id)
  }

  async save(credential: Credential): Promise<void> {
    const row = CredentialMapper.toPersistence(credential)
    const value = this.cipher.encrypt(JSON.stringify(row.value))
    await this.db
      .insert(credentials)
      .values({
        id: row.id,
        name: row.name,
        pluginName: row.pluginName,
        type: row.type,
        status: row.status,
        isPrimary: row.isPrimary,
        value,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
      .onConflictDoUpdate({
        target: credentials.id,
        set: {
          name: row.name,
          status: row.status,
          isPrimary: row.isPrimary,
          value,
          updatedAt: row.updatedAt,
        },
      })
  }

  async delete(id: CredentialId): Promise<void> {
    await this.db.delete(credentials).where(eq(credentials.id, id.value))
  }

  // Tolerant read: try AES-decrypt -> JSON, then plain JSON (legacy rows), then {}.
  private decryptValue(raw: string): JsonObject {
    if (!raw || raw === '{}') return {}
    try {
      return toJsonObject(JSON.parse(this.cipher.decrypt(raw)))
    } catch {
      try {
        return toJsonObject(JSON.parse(raw))
      } catch {
        return {}
      }
    }
  }
}

const toJsonObject = (parsed: unknown): JsonObject =>
  typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as JsonObject) : {}
