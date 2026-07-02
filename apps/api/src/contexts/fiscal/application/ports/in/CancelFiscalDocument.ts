import { Result } from '@/shared/kernel/Result'
import { FiscalResult } from '@/contexts/fiscal/domain/FiscalResult'

// Driving port. Cancels an authorized document (SEFAZ evento 110111) by its chave,
// with a justification (`reason`, min 15 chars per SEFAZ). Requires the A1
// certificate to be configured.
export interface CancelFiscalDocumentCommand {
  chave: string
  reason: string
}

export interface CancelFiscalDocument {
  execute(cmd: CancelFiscalDocumentCommand): Promise<Result<FiscalResult>>
}
