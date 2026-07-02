import { Result } from '@/shared/kernel/Result'
import { Boleto } from '@/contexts/payments/domain/Boleto'
import { Pagador } from '@/contexts/payments/domain/Pagador'
import { Beneficiario } from '@/contexts/payments/domain/SicrediConfig'
import { SicrediCredential } from '@/contexts/payments/domain/sicrediCredential'

// ACL out-port wrapping a boleto-issuing bank (Sicredi Cobrança is the first impl).
// Kept provider-agnostic: the application sees only this port and never a thrown
// error — failures come back as `Result` failures. All HTTP, the OAuth2 token
// exchange, payload mapping and bank quirks live in the adapter.
//
// `auth` carries everything the adapter needs to authenticate AND identify the
// issuing account: the resolved credential material (the use-case fetches it from
// the credential store via the ResolveCredential ACL) plus the validated
// beneficiário (read from settings). The adapter performs the OAuth token exchange
// itself from `auth.credential`, so no token is ever hardcoded and the adapter stays
// stateless between calls.
export interface BoletoAuth {
  credential: SicrediCredential
  beneficiario: Beneficiario
}

export interface CreateBoletoInput {
  pagador: Pagador
  // Integer centavos (BRL). The application converts reais -> centavos before here.
  valorCents: number
  // ISO date (YYYY-MM-DD) the boleto is due.
  vencimento: string
  // Caller-supplied document number (seu número) echoed back by the bank.
  seuNumero?: string
  // Free-text instruction line printed on the slip.
  mensagem?: string
}

export interface BoletoProvider {
  createBoleto(auth: BoletoAuth, input: CreateBoletoInput): Promise<Result<Boleto>>
  getBoleto(auth: BoletoAuth, nossoNumero: string): Promise<Result<Boleto>>
}
