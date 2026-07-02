import { Result, fail } from '@/shared/kernel/Result'
import { GetBoleto, GetBoletoQuery } from '@/contexts/payments/application/ports/in/GetBoleto'
import { BoletoProvider } from '@/contexts/payments/application/ports/out/BoletoProvider'
import { ResolveCredential } from '@/contexts/payments/application/ports/out/ResolveCredential'
import { Boleto } from '@/contexts/payments/domain/Boleto'
import { SICREDI_PLUGIN, extractSicrediCredential, extractSicrediConfig } from '@/contexts/payments/domain/sicrediCredential'
import { resolveBeneficiario } from '@/contexts/payments/domain/SicrediConfig'
import { PaymentError } from '@/contexts/payments/domain/PaymentError'

// Application service. Resolve the Sicredi credential (fail with the "não conectado"
// message when absent) and the beneficiário config folded into the SAME credential
// bag (fail with "incompleto" when so, since the bank query is scoped by
// codigoBeneficiario), then read the boleto back from the provider. Depends ONLY on
// ports.
export class GetBoletoService implements GetBoleto {
  constructor(
    private readonly credentials: ResolveCredential,
    private readonly provider: BoletoProvider,
  ) {}

  async execute(query: GetBoletoQuery): Promise<Result<Boleto>> {
    const resolved = await this.credentials.resolve({ pluginName: SICREDI_PLUGIN })
    if (!resolved.ok) return fail(resolved.error)
    const credential = extractSicrediCredential(resolved.value)
    if (!credential) return fail(PaymentError.sicrediNotConnected)

    const beneficiario = resolveBeneficiario(extractSicrediConfig(resolved.value))
    if (!beneficiario.ok) return fail(beneficiario.error)

    return this.provider.getBoleto({ credential, beneficiario: beneficiario.value }, query.nossoNumero)
  }
}
