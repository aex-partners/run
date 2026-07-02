import { Result, fail } from '@/shared/kernel/Result'
import { CreateBoleto, CreateBoletoCommand } from '@/contexts/payments/application/ports/in/CreateBoleto'
import { BoletoProvider } from '@/contexts/payments/application/ports/out/BoletoProvider'
import { ResolveCredential } from '@/contexts/payments/application/ports/out/ResolveCredential'
import { Boleto } from '@/contexts/payments/domain/Boleto'
import { SICREDI_PLUGIN, extractSicrediCredential, extractSicrediConfig } from '@/contexts/payments/domain/sicrediCredential'
import { resolveBeneficiario } from '@/contexts/payments/domain/SicrediConfig'
import { PaymentError } from '@/contexts/payments/domain/PaymentError'

// Application service. Pure orchestration: resolve the Sicredi credential from the
// credential store via the ResolveCredential ACL (plugin "sicredi"); if it is not
// connected, fail with the actionable "Sicredi não conectado" message. The
// beneficiário config is folded into the SAME credential bag (one Connect dialog),
// so extract and validate it; if incomplete, fail with the "beneficiário incompleto"
// message. Otherwise hand off to the provider, which performs the OAuth2 token
// exchange and the boleto registration. Depends ONLY on ports.
export class CreateBoletoService implements CreateBoleto {
  constructor(
    private readonly credentials: ResolveCredential,
    private readonly provider: BoletoProvider,
  ) {}

  async execute(cmd: CreateBoletoCommand): Promise<Result<Boleto>> {
    const resolved = await this.credentials.resolve({ pluginName: SICREDI_PLUGIN })
    if (!resolved.ok) return fail(resolved.error)
    const credential = extractSicrediCredential(resolved.value)
    if (!credential) return fail(PaymentError.sicrediNotConnected)

    const beneficiario = resolveBeneficiario(extractSicrediConfig(resolved.value))
    if (!beneficiario.ok) return fail(beneficiario.error)

    return this.provider.createBoleto(
      { credential, beneficiario: beneficiario.value },
      {
        pagador: cmd.pagador,
        valorCents: cmd.valorCents,
        vencimento: cmd.vencimento,
        seuNumero: cmd.seuNumero,
        mensagem: cmd.mensagem,
      },
    )
  }
}
