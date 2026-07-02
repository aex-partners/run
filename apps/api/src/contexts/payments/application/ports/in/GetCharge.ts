import { Result } from '@/shared/kernel/Result'
import { Charge } from '@/contexts/payments/domain/Charge'

// Driving port. Looks a charge up at the provider by its id and returns the
// current `Charge` (including its settled/pending status).
export interface GetChargeQuery {
  chargeId: string
}

export interface GetCharge {
  execute(query: GetChargeQuery): Promise<Result<Charge>>
}
