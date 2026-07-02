import { Result } from '@/shared/kernel/Result'
import { FiscalResult } from '@/contexts/fiscal/domain/FiscalResult'

// Driving port (read). Consults SEFAZ for the current situation of an emitted
// document by its 44-digit chave. Requires the A1 certificate to be configured.
export interface GetFiscalStatusQuery {
  chave: string
}

export interface GetFiscalStatus {
  execute(query: GetFiscalStatusQuery): Promise<Result<FiscalResult>>
}
