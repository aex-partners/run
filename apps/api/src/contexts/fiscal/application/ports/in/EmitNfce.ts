import { Result } from '@/shared/kernel/Result'
import { Ambiente } from '@/contexts/fiscal/domain/Ambiente'
import { Destinatario } from '@/contexts/fiscal/domain/Destinatario'
import { FiscalItem } from '@/contexts/fiscal/domain/FiscalItem'
import { FiscalResult } from '@/contexts/fiscal/domain/FiscalResult'

// Driving port. Plain-data command in, a `FiscalResult` out. Called by the AI
// `emitir_nfce` tool and by the HTTP controller. NFC-e (modelo 65) additionally
// requires the emitente CSC + cscId (enforced by the service). `destinatario` is
// optional for consumer sales; when omitted the service emits an anonymous NFC-e.
export interface EmitNfceCommand {
  destinatario?: Destinatario
  items: readonly FiscalItem[]
  ambiente?: Ambiente
}

export interface EmitNfce {
  execute(cmd: EmitNfceCommand): Promise<Result<FiscalResult>>
}
