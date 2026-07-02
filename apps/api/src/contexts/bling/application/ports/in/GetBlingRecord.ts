import { Result } from '@/shared/kernel/Result'
import { BlingRecord } from '@/contexts/bling/domain/BlingRecord'
import { BlingResource } from '@/contexts/bling/domain/BlingResource'

// Driving port. Fetches a single Bling record by id. Returns null when Bling
// reports it as not found; fails with the "connect in Settings" message when
// Bling is not connected.
export interface GetBlingRecordQuery {
  resource: BlingResource
  id: string
}

export interface GetBlingRecord {
  execute(query: GetBlingRecordQuery): Promise<Result<BlingRecord | null>>
}
