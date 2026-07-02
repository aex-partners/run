import { ok, Result } from '@/shared/kernel/Result'
import { Certificate } from '@/contexts/fiscal/domain/credential'
import { FiscalDocument, documentTotal } from '@/contexts/fiscal/domain/FiscalDocument'
import { FiscalResult } from '@/contexts/fiscal/domain/FiscalResult'
import { FiscalProvider } from '@/contexts/fiscal/application/ports/out/FiscalProvider'
import { modelCode } from '@/contexts/fiscal/domain/FiscalModel'

// In-memory, deterministic FiscalProvider for tests and the offline demo. No
// network, no certificate parsing: it mints a plausible 44-digit chave + protocol
// from a counter, stores the "emitted" documents, and reports status 'autorizado'.
// The shape mirrors the real adapter so use-cases can be exercised offline. Never
// throws — every path returns a `Result`.
export class StubFiscalProvider implements FiscalProvider {
  private seq = 0
  readonly emitted = new Map<string, { doc: FiscalDocument; result: FiscalResult }>()

  async emit(doc: FiscalDocument, _cert: Certificate): Promise<Result<FiscalResult>> {
    this.seq += 1
    // Deterministic 44-char numeric key: cUF(35=SP) + AAMM + zeros + model + seq.
    const chave = `35${'0'.repeat(38 - modelCode(doc.model).length)}${modelCode(doc.model)}${String(this.seq).padStart(2, '0')}`.slice(0, 44).padEnd(44, '0')
    const result: FiscalResult = {
      chave,
      protocolo: `stub-prot-${this.seq}`,
      status: 'autorizado',
      xml: `<NFe stub="true" model="${doc.model}" total="${documentTotal(doc.items)}"/>`,
    }
    this.emitted.set(chave, { doc, result })
    return ok(result)
  }

  async getStatus(chave: string, _cert: Certificate): Promise<Result<FiscalResult>> {
    const found = this.emitted.get(chave)
    if (found) return ok(found.result)
    return ok({ chave, protocolo: '', status: 'pendente', xml: '' })
  }

  async cancel(chave: string, _reason: string, _cert: Certificate): Promise<Result<FiscalResult>> {
    this.seq += 1
    const result: FiscalResult = {
      chave,
      protocolo: `stub-cancel-${this.seq}`,
      status: 'cancelado',
      xml: `<retEvento stub="true" chave="${chave}"/>`,
    }
    const prior = this.emitted.get(chave)
    if (prior) this.emitted.set(chave, { doc: prior.doc, result })
    return ok(result)
  }
}
