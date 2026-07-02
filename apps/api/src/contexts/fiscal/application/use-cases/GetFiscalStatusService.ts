import { Result, fail } from '@/shared/kernel/Result'
import { GetFiscalStatus, GetFiscalStatusQuery } from '@/contexts/fiscal/application/ports/in/GetFiscalStatus'
import { FiscalProvider } from '@/contexts/fiscal/application/ports/out/FiscalProvider'
import { ResolveCredential } from '@/contexts/fiscal/application/ports/out/ResolveCredential'
import { FiscalResult } from '@/contexts/fiscal/domain/FiscalResult'
import { NFE_CERTIFICATE_PLUGIN, extractCertificate } from '@/contexts/fiscal/domain/credential'
import { FiscalError } from '@/contexts/fiscal/domain/FiscalError'

// Application service: consult SEFAZ for a document's situation by chave. Only the
// certificate is needed (the adapter derives the UF from the chave). Pure
// orchestration; depends ONLY on ports.
export class GetFiscalStatusService implements GetFiscalStatus {
  constructor(
    private readonly credentials: ResolveCredential,
    private readonly provider: FiscalProvider,
  ) {}

  async execute(query: GetFiscalStatusQuery): Promise<Result<FiscalResult>> {
    const resolved = await this.credentials.resolve({ pluginName: NFE_CERTIFICATE_PLUGIN })
    if (!resolved.ok) return fail(resolved.error)
    const cert = extractCertificate(resolved.value)
    if (!cert) return fail(FiscalError.certificateNotConfigured)
    return this.provider.getStatus(query.chave, cert)
  }
}
