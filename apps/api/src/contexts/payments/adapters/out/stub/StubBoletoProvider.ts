import { ok, Result } from '@/shared/kernel/Result'
import {
  BoletoAuth,
  BoletoProvider,
  CreateBoletoInput,
} from '@/contexts/payments/application/ports/out/BoletoProvider'
import { Boleto } from '@/contexts/payments/domain/Boleto'

// In-memory, deterministic BoletoProvider for tests and the offline demo. No
// network, no OAuth: it mints a nossoNumero from a counter, stores boletos, and
// echoes a plausible linha digitável / código de barras so the shape mirrors the
// real adapter. Never throws — every path returns a `Result`.
export class StubBoletoProvider implements BoletoProvider {
  private seq = 0
  readonly boletos = new Map<string, Boleto>()

  async createBoleto(_auth: BoletoAuth, input: CreateBoletoInput): Promise<Result<Boleto>> {
    this.seq += 1
    const nossoNumero = `stub-boleto-${this.seq}`
    const boleto: Boleto = {
      nossoNumero,
      linhaDigitavel: `74891.11223 44556.677889 00112.233445 6 ${String(this.seq).padStart(14, '0')}`,
      codigoBarras: `748${String(this.seq).padStart(41, '0')}`,
      valorCents: input.valorCents,
      vencimento: input.vencimento,
      status: 'registered',
      pagador: input.pagador,
      // Hybrid boleto+PIX: echo a deterministic QR payload + txid.
      pixQrCode: `PIX-${nossoNumero}`,
      txid: `TXID${String(this.seq).padStart(28, '0')}`,
    }
    this.boletos.set(nossoNumero, boleto)
    return ok(boleto)
  }

  async getBoleto(_auth: BoletoAuth, nossoNumero: string): Promise<Result<Boleto>> {
    const found = this.boletos.get(nossoNumero)
    if (found) return ok(found)
    // Unknown nossoNumero: return a deterministic registered boleto rather than
    // failing, so tests can exercise the happy path without a prior create.
    return ok({
      nossoNumero,
      linhaDigitavel: '',
      codigoBarras: '',
      valorCents: 0,
      vencimento: '',
      status: 'registered',
      pagador: { nome: '', cpfCnpj: '' },
    })
  }
}
