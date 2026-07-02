// The payer of a charge. `taxId` is the Brazilian CPF/CNPJ (digits only) the
// provider requires to emit a boleto or PIX charge.
export interface Customer {
  readonly name: string
  readonly email: string
  readonly taxId: string
}
