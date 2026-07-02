import { BoletoStatus } from '@/contexts/payments/domain/BoletoStatus'
import { Pagador } from '@/contexts/payments/domain/Pagador'

// A registered boleto as the payments context models it, independent of any bank's
// response shape. `nossoNumero` is the bank-assigned identifier used to look the
// boleto up later (it plays the role of the id). `valorCents` is an integer in
// centavos (BRL has 2 decimals) so money never rides on a float. `vencimento` is an
// ISO date (YYYY-MM-DD). When the boleto is issued as a hybrid boleto+PIX, the bank
// returns a PIX QR payload (`pixQrCode`) and its transaction id (`txid`). `pdfUrl`
// points at the printable slip when the bank exposes one.
export interface Boleto {
  readonly nossoNumero: string
  readonly linhaDigitavel: string
  readonly codigoBarras: string
  readonly valorCents: number
  readonly vencimento: string
  readonly status: BoletoStatus
  readonly pagador: Pagador
  readonly pixQrCode?: string
  readonly txid?: string
  readonly pdfUrl?: string
}
