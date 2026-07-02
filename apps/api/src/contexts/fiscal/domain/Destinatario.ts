import { Endereco } from '@/contexts/fiscal/domain/Endereco'

// The recipient of the document. `cpfCnpj` is digits-only (the adapter routes it to
// SEFAZ `CPF` or `CNPJ` by length). `endereco` is mandatory for NF-e (modelo 55)
// and omitted for NFC-e (modelo 65), which carries no recipient address.
export interface Destinatario {
  readonly nome: string
  readonly cpfCnpj: string
  readonly ie?: string
  readonly email?: string
  readonly endereco?: Endereco
}
