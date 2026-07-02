import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { forms } from '@/platform/db/schema'
import { FormRepository } from '@/contexts/forms/application/ports/out/FormRepository'
import { Form } from '@/contexts/forms/domain/Form'
import { FormId } from '@/contexts/forms/domain/FormId'
import { FormField } from '@/contexts/forms/domain/FormField'
import { FormSettings } from '@/contexts/forms/domain/FormSettings'
import { FormMapper, FormRow } from '@/contexts/forms/application/mappers/FormMapper'

type Row = typeof forms.$inferSelect

// Driven adapter. Stores `fields`/`settings` as JSON text and `isPublic` as the
// 0/1 integer column AEX uses; the mapper round-trips the parsed shapes.
export class DrizzleFormRepository implements FormRepository {
  constructor(private readonly db: Database) {}

  nextId(): FormId {
    return FormId.of(randomUUID())
  }

  nextFieldId(): string {
    return randomUUID()
  }

  nextToken(): string {
    return randomUUID()
  }

  async findById(id: FormId): Promise<Form | null> {
    const rows = await this.db.select().from(forms).where(eq(forms.id, id.value)).limit(1)
    const row = rows[0]
    return row ? FormMapper.toDomain(this.toRow(row)) : null
  }

  async findByToken(token: string): Promise<Form | null> {
    const rows = await this.db.select().from(forms).where(eq(forms.publicToken, token)).limit(1)
    const row = rows[0]
    return row ? FormMapper.toDomain(this.toRow(row)) : null
  }

  async save(form: Form): Promise<void> {
    const row = FormMapper.toPersistence(form)
    const now = new Date()
    const fields = JSON.stringify(row.fields)
    const settings = JSON.stringify(row.settings)
    const isPublic = row.isPublic ? 1 : 0
    await this.db
      .insert(forms)
      .values({
        id: row.id,
        entityId: row.entityId,
        name: row.name,
        description: row.description,
        fields,
        settings,
        publicToken: row.publicToken,
        isPublic,
        createdBy: row.createdBy,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: forms.id,
        set: {
          name: row.name,
          description: row.description,
          fields,
          settings,
          publicToken: row.publicToken,
          isPublic,
          updatedAt: now,
        },
      })
  }

  async delete(id: FormId): Promise<void> {
    await this.db.delete(forms).where(eq(forms.id, id.value))
  }

  private toRow(row: Row): FormRow {
    return {
      id: row.id,
      entityId: row.entityId,
      name: row.name,
      description: row.description,
      fields: JSON.parse(row.fields) as FormField[],
      settings: JSON.parse(row.settings) as FormSettings,
      publicToken: row.publicToken,
      isPublic: row.isPublic === 1,
      createdBy: row.createdBy,
    }
  }
}
