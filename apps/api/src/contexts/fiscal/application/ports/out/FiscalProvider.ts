import { Result } from '@/shared/kernel/Result'
import { Certificate } from '@/contexts/fiscal/domain/credential'
import { FiscalDocument } from '@/contexts/fiscal/domain/FiscalDocument'
import { FiscalResult } from '@/contexts/fiscal/domain/FiscalResult'

// ACL out-port wrapping the external SEFAZ emitter (node-sped-nfe, direct to SEFAZ,
// no gateway). Every method takes the already-resolved A1 `cert` (the use-case
// fetches it from the credential store via the ResolveCredential ACL and passes it
// in, so the adapter stays stateless and the certificate is never hardcoded). All
// XML building, signing, SOAP transport and provider quirks live in the adapter;
// the application sees only this port and never a thrown error — SEFAZ/network
// faults come back as `Result` failures. `ambiente` rides on the document.
export interface FiscalProvider {
  // Build, sign and transmit the document (modelo 55 or 65) to SEFAZ.
  emit(doc: FiscalDocument, cert: Certificate): Promise<Result<FiscalResult>>
  // Consult the current situation of an emitted document by its 44-digit chave.
  getStatus(chave: string, cert: Certificate): Promise<Result<FiscalResult>>
  // Cancel an authorized document (evento 110111) with a justification reason.
  cancel(chave: string, reason: string, cert: Certificate): Promise<Result<FiscalResult>>
}
