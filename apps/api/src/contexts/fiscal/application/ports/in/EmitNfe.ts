import { Result } from '@/shared/kernel/Result'
import { Ambiente } from '@/contexts/fiscal/domain/Ambiente'
import { Destinatario } from '@/contexts/fiscal/domain/Destinatario'
import { FiscalItem } from '@/contexts/fiscal/domain/FiscalItem'
import { FiscalResult } from '@/contexts/fiscal/domain/FiscalResult'

// Driving port. Plain-data command in, a `FiscalResult` out. Called by the AI
// `emitir_nfe` tool and by the HTTP controller. The emitente is NOT part of the
// command — it comes from the company fiscal settings, resolved inside the service.
export interface EmitNfeCommand {
  destinatario: Destinatario
  items: readonly FiscalItem[]
  // Per-request environment override; defaults to the configured/homologacao value.
  ambiente?: Ambiente
}

export interface EmitNfe {
  execute(cmd: EmitNfeCommand): Promise<Result<FiscalResult>>
}
