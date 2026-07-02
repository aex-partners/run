import { Form } from '@/contexts/forms/domain/Form'
import { FormId } from '@/contexts/forms/domain/FormId'

// Driven port. The application states WHAT it needs from persistence; an adapter
// under adapters/out implements HOW (Drizzle, in-memory, ...). Id/token/field-id
// minting lives here so the domain stays deterministic.
export interface FormRepository {
  nextId(): FormId
  nextFieldId(): string
  nextToken(): string
  findById(id: FormId): Promise<Form | null>
  findByToken(token: string): Promise<Form | null>
  save(form: Form): Promise<void>
  delete(id: FormId): Promise<void>
}
