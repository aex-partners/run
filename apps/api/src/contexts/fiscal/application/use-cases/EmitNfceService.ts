import { Result, fail } from '@/shared/kernel/Result'
import { EmitNfce, EmitNfceCommand } from '@/contexts/fiscal/application/ports/in/EmitNfce'
import { FiscalProvider } from '@/contexts/fiscal/application/ports/out/FiscalProvider'
import { ResolveCredential } from '@/contexts/fiscal/application/ports/out/ResolveCredential'
import { Destinatario } from '@/contexts/fiscal/domain/Destinatario'
import { FiscalDocument } from '@/contexts/fiscal/domain/FiscalDocument'
import { FiscalResult } from '@/contexts/fiscal/domain/FiscalResult'
import {
  NFE_CERTIFICATE_PLUGIN,
  extractCertificate,
  extractCompanyFiscalConfig,
} from '@/contexts/fiscal/domain/credential'
import { resolveAmbiente, resolveEmitente } from '@/contexts/fiscal/domain/CompanyFiscalConfig'
import { FiscalError } from '@/contexts/fiscal/domain/FiscalError'

// An anonymous consumer, used when an NFC-e is emitted without an identified buyer
// (the common PDV case). The adapter drops an empty cpfCnpj from the modelo 65 dest.
const ANONYMOUS: Destinatario = { nome: 'CONSUMIDOR', cpfCnpj: '' }

// Application service for NFC-e (modelo 65). Same certificate + company-config
// orchestration as NF-e (both folded into the SAME "nfe-certificate" credential bag),
// plus one extra guard: NFC-e signs a consumer QR code with the CSC (Código de
// Segurança do Contribuinte), so the emitente CSC + cscId must be configured —
// otherwise fail with the actionable message. Pure orchestration; depends ONLY on
// ports.
export class EmitNfceService implements EmitNfce {
  constructor(
    private readonly credentials: ResolveCredential,
    private readonly provider: FiscalProvider,
  ) {}

  async execute(cmd: EmitNfceCommand): Promise<Result<FiscalResult>> {
    const resolved = await this.credentials.resolve({ pluginName: NFE_CERTIFICATE_PLUGIN })
    if (!resolved.ok) return fail(resolved.error)
    const cert = extractCertificate(resolved.value)
    if (!cert) return fail(FiscalError.certificateNotConfigured)

    const cfg = extractCompanyFiscalConfig(resolved.value)
    const emitente = resolveEmitente(cfg)
    if (!emitente.ok) return fail(emitente.error)
    // NFC-e-only: CSC + cscId are mandatory to sign the consumer QR code.
    if (!emitente.value.csc || !emitente.value.cscId) {
      return fail(FiscalError.cscNotConfigured)
    }

    const doc: FiscalDocument = {
      model: 'nfce',
      emitente: emitente.value,
      destinatario: cmd.destinatario ?? ANONYMOUS,
      items: cmd.items,
      ambiente: resolveAmbiente(cfg, cmd.ambiente),
    }
    return this.provider.emit(doc, cert)
  }
}
