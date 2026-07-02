import { Result, fail } from '@/shared/kernel/Result'
import { EmitNfe, EmitNfeCommand } from '@/contexts/fiscal/application/ports/in/EmitNfe'
import { FiscalProvider } from '@/contexts/fiscal/application/ports/out/FiscalProvider'
import { ResolveCredential } from '@/contexts/fiscal/application/ports/out/ResolveCredential'
import { FiscalDocument } from '@/contexts/fiscal/domain/FiscalDocument'
import { FiscalResult } from '@/contexts/fiscal/domain/FiscalResult'
import {
  NFE_CERTIFICATE_PLUGIN,
  extractCertificate,
  extractCompanyFiscalConfig,
} from '@/contexts/fiscal/domain/credential'
import { resolveAmbiente, resolveEmitente } from '@/contexts/fiscal/domain/CompanyFiscalConfig'
import { FiscalError } from '@/contexts/fiscal/domain/FiscalError'

// Application service for NF-e (modelo 55). Pure orchestration: resolve the whole
// fiscal setup from the credential store via the ResolveCredential ACL (plugin
// "nfe-certificate"). The A1 certificate AND the company fiscal config are folded
// into the SAME credential bag (one Connect dialog), so extract both from it: if the
// certificate is absent, fail with the actionable "não configurado" message; validate
// the company config into an Emitente and, if incomplete, fail with the "dados
// incompletos" message. Otherwise build the normalized FiscalDocument (emitente from
// the bag; destinatario + items from the command) and hand off to the provider.
// Depends ONLY on ports.
export class EmitNfeService implements EmitNfe {
  constructor(
    private readonly credentials: ResolveCredential,
    private readonly provider: FiscalProvider,
  ) {}

  async execute(cmd: EmitNfeCommand): Promise<Result<FiscalResult>> {
    const resolved = await this.credentials.resolve({ pluginName: NFE_CERTIFICATE_PLUGIN })
    if (!resolved.ok) return fail(resolved.error)
    const cert = extractCertificate(resolved.value)
    if (!cert) return fail(FiscalError.certificateNotConfigured)

    const cfg = extractCompanyFiscalConfig(resolved.value)
    const emitente = resolveEmitente(cfg)
    if (!emitente.ok) return fail(emitente.error)

    const doc: FiscalDocument = {
      model: 'nfe',
      emitente: emitente.value,
      destinatario: cmd.destinatario,
      items: cmd.items,
      ambiente: resolveAmbiente(cfg, cmd.ambiente),
    }
    return this.provider.emit(doc, cert)
  }
}
