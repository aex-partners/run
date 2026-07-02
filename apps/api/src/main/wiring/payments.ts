// Wiring for the `payments` context. Two providers live here side by side:
//   1. PagSeguro charges + payment links (the original flow, untouched).
//   2. Sicredi boletos (REST + OAuth2), a SEPARATE BoletoProvider port + adapter.
// ACL bridge:
//   * ResolveCredential -> credentials ResolveCredential in-port. The PagSeguro
//     token is resolved by plugin name "pagseguro"; the Sicredi credential bag
//     ({ apiKey?, username?, password?, cooperativa?, agencia?, codigoBeneficiario?,
//     ambiente? }) by plugin name "sicredi" (SAME provider, different plugin name).
//     The beneficiário config is folded into that same bag (one Connect dialog), so
//     no settings ACL is needed here any more.
// Builds the PagSeguro client, the Sicredi boleto provider, the use-cases and the
// tRPC controller. Exposes the in-ports so the assistant tool assembly and routes can
// reach them.
import { Infra } from '@/main/wiring/infra'

import { ResolveCredential as CredentialsResolveCredential } from '@/contexts/credentials/application/ports/in/ResolveCredential'

import { PagSeguroClient } from '@/contexts/payments/adapters/out/http/PagSeguroClient'
import { SicrediBoletoProvider } from '@/contexts/payments/adapters/out/http/SicrediBoletoProvider'
import { CreateChargeService } from '@/contexts/payments/application/use-cases/CreateChargeService'
import { GetChargeService } from '@/contexts/payments/application/use-cases/GetChargeService'
import { CreatePaymentLinkService } from '@/contexts/payments/application/use-cases/CreatePaymentLinkService'
import { CreateBoletoService } from '@/contexts/payments/application/use-cases/CreateBoletoService'
import { GetBoletoService } from '@/contexts/payments/application/use-cases/GetBoletoService'
import { paymentsController } from '@/contexts/payments/adapters/in/http/PaymentsController'
import { ResolveCredential as PaymentsResolveCredential } from '@/contexts/payments/application/ports/out/ResolveCredential'

type PaymentsDeps = {
  resolveCredential: CredentialsResolveCredential
}

export function wirePayments(_infra: Infra, deps: PaymentsDeps) {
  const { resolveCredential } = deps

  const provider = new PagSeguroClient()
  const boletoProvider = new SicrediBoletoProvider()

  // ACL bridge: payments ResolveCredential -> credentials ResolveCredential in-port
  // (resolves both the "pagseguro" token and the "sicredi" credential bag).
  const paymentsResolveCredential: PaymentsResolveCredential = {
    resolve: (req) => resolveCredential.execute(req),
  }

  const createCharge = new CreateChargeService(paymentsResolveCredential, provider)
  const getCharge = new GetChargeService(paymentsResolveCredential, provider)
  const createPaymentLink = new CreatePaymentLinkService(paymentsResolveCredential, provider)
  const createBoleto = new CreateBoletoService(paymentsResolveCredential, boletoProvider)
  const getBoleto = new GetBoletoService(paymentsResolveCredential, boletoProvider)

  const paymentsCtl = paymentsController({
    create: createCharge,
    get: getCharge,
    link: createPaymentLink,
    createBoleto,
    getBoleto,
  })

  return {
    controller: paymentsCtl,
    ports: { createCharge, getCharge, createPaymentLink, createBoleto, getBoleto },
  }
}

export type PaymentsWiring = ReturnType<typeof wirePayments>
