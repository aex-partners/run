// Wiring for the `fiscal` context (Brazilian NF-e modelo 55 + NFC-e modelo 65,
// emitted DIRECTLY to SEFAZ via node-sped-nfe, no gateway). One ACL bridge, mirror
// of `payments`:
//   1. ResolveCredential -> credentials ResolveCredential in-port. The WHOLE fiscal
//      setup lives in the encrypted credential store, resolved by the plugin name
//      "nfe-certificate"; its value bag folds the A1 certificate AND the emitente
//      fiscal config into ONE bag (one Connect dialog):
//        { pfx: <base64 .pfx>, password,
//          razaoSocial, cnpj, ie, regime (1=Simples,2=SimplesExcesso,3=Normal), uf,
//          logradouro, numero, bairro, municipio, cep, codigoMunicipio?,
//          ambiente ('homologacao' | 'producao', default homologacao),
//          csc?, cscId?  (NFC-e only) }
// The pure extractors + resolvers in the domain validate completeness, so no settings
// ACL is needed here any more. Builds the provider, the four use-cases and the tRPC
// controller; exposes the in-ports so the assistant tool assembly and routes can
// reach them.
import { Infra } from '@/main/wiring/infra'

import { ResolveCredential as CredentialsResolveCredential } from '@/contexts/credentials/application/ports/in/ResolveCredential'

import { NodeSpedNfeProvider } from '@/contexts/fiscal/adapters/out/lib/NodeSpedNfeProvider'
import { EmitNfeService } from '@/contexts/fiscal/application/use-cases/EmitNfeService'
import { EmitNfceService } from '@/contexts/fiscal/application/use-cases/EmitNfceService'
import { GetFiscalStatusService } from '@/contexts/fiscal/application/use-cases/GetFiscalStatusService'
import { CancelFiscalDocumentService } from '@/contexts/fiscal/application/use-cases/CancelFiscalDocumentService'
import { fiscalController } from '@/contexts/fiscal/adapters/in/http/FiscalController'
import { ResolveCredential as FiscalResolveCredential } from '@/contexts/fiscal/application/ports/out/ResolveCredential'

type FiscalDeps = {
  resolveCredential: CredentialsResolveCredential
}

export function wireFiscal(_infra: Infra, deps: FiscalDeps) {
  const { resolveCredential } = deps

  const provider = new NodeSpedNfeProvider()

  // ACL bridge: fiscal ResolveCredential -> credentials ResolveCredential in-port
  // (the SAME provider payments uses; resolves the "nfe-certificate" credential bag,
  // which carries both the A1 certificate and the emitente fiscal config).
  const fiscalResolveCredential: FiscalResolveCredential = {
    resolve: (req) => resolveCredential.execute(req),
  }

  const emitNfe = new EmitNfeService(fiscalResolveCredential, provider)
  const emitNfce = new EmitNfceService(fiscalResolveCredential, provider)
  const getFiscalStatus = new GetFiscalStatusService(fiscalResolveCredential, provider)
  const cancelFiscalDocument = new CancelFiscalDocumentService(fiscalResolveCredential, provider)

  const fiscalCtl = fiscalController({
    emitNfe,
    emitNfce,
    status: getFiscalStatus,
    cancel: cancelFiscalDocument,
  })

  return {
    controller: fiscalCtl,
    ports: { emitNfe, emitNfce, getFiscalStatus, cancelFiscalDocument },
  }
}

export type FiscalWiring = ReturnType<typeof wireFiscal>
