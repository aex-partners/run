import { Result, fail } from '@/shared/kernel/Result'
import { CancelFiscalDocument, CancelFiscalDocumentCommand } from '@/contexts/fiscal/application/ports/in/CancelFiscalDocument'
import { FiscalProvider } from '@/contexts/fiscal/application/ports/out/FiscalProvider'
import { ResolveCredential } from '@/contexts/fiscal/application/ports/out/ResolveCredential'
import { FiscalResult } from '@/contexts/fiscal/domain/FiscalResult'
import { NFE_CERTIFICATE_PLUGIN, extractCertificate } from '@/contexts/fiscal/domain/credential'
import { FiscalError } from '@/contexts/fiscal/domain/FiscalError'

// Application service: cancel an authorized document (evento 110111) by chave with a
// justification. Only the certificate is needed. Pure orchestration; depends ONLY on
// ports.
export class CancelFiscalDocumentService implements CancelFiscalDocument {
  constructor(
    private readonly credentials: ResolveCredential,
    private readonly provider: FiscalProvider,
  ) {}

  async execute(cmd: CancelFiscalDocumentCommand): Promise<Result<FiscalResult>> {
    const resolved = await this.credentials.resolve({ pluginName: NFE_CERTIFICATE_PLUGIN })
    if (!resolved.ok) return fail(resolved.error)
    const cert = extractCertificate(resolved.value)
    if (!cert) return fail(FiscalError.certificateNotConfigured)
    return this.provider.cancel(cmd.chave, cmd.reason, cert)
  }
}
