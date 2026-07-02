import { Endereco } from '@/contexts/fiscal/domain/Endereco'

// Tax regime of the issuing company (SEFAZ `CRT`):
//   1 = Simples Nacional          -> items use CSOSN (ICMSSN* groups)
//   2 = Simples Nacional, excesso  -> items use CSOSN as well
//   3 = Regime Normal (Lucro ...)  -> items use CST (ICMS00/10/... groups)
export type RegimeTributario = 1 | 2 | 3

export const isRegimeTributario = (v: unknown): v is RegimeTributario =>
  v === 1 || v === 2 || v === 3

// Whether this regime bills ICMS through the Simples Nacional CSOSN path.
export const usesSimplesNacional = (r: RegimeTributario): boolean => r === 1 || r === 2

// The company issuing the document. `csc`/`cscId` are the NFC-e Código de Segurança
// do Contribuinte (used to sign the consumer QR code); they are absent for NF-e and
// only required by the NFC-e use-case.
export interface Emitente {
  readonly cnpj: string
  readonly ie: string
  readonly razaoSocial: string
  readonly regimeTributario: RegimeTributario
  readonly endereco: Endereco
  readonly uf: string
  readonly csc?: string
  readonly cscId?: string
}
