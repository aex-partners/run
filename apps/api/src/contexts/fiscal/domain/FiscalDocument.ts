import { Ambiente } from '@/contexts/fiscal/domain/Ambiente'
import { Destinatario } from '@/contexts/fiscal/domain/Destinatario'
import { Emitente } from '@/contexts/fiscal/domain/Emitente'
import { FiscalItem } from '@/contexts/fiscal/domain/FiscalItem'
import { FiscalModel } from '@/contexts/fiscal/domain/FiscalModel'

// The normalized, provider-agnostic fiscal document the application hands to the
// FiscalProvider out-port. The adapter maps this onto node-sped-nfe's modelo 55/65
// payload. `emitente` is filled from company settings; `destinatario` and `items`
// come from the caller (AI tool or HTTP).
export interface FiscalDocument {
  readonly model: FiscalModel
  readonly emitente: Emitente
  readonly destinatario: Destinatario
  readonly items: readonly FiscalItem[]
  readonly ambiente: Ambiente
}

// Sum of the line totals, in reais rounded to 2 decimals. Pure.
export const documentTotal = (items: readonly FiscalItem[]): number =>
  Math.round(items.reduce((acc, i) => acc + i.valorTotal, 0) * 100) / 100
