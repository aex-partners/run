import { FormView } from '@/contexts/forms/application/queries/ListForms'

// Read side (CQRS). AEX `getById`.
export interface GetFormOptions {
  id: string
}

export interface GetForm {
  execute(opts: GetFormOptions): Promise<FormView | null>
}
