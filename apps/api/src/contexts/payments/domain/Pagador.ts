// The payer (sacado) of a boleto, as the payments context models it, independent of
// any bank's payload shape. `cpfCnpj` is digits-only (the adapter routes it to the
// bank's CPF vs CNPJ field by length). This is distinct from `Customer` (used by the
// PagSeguro charge flow, which carries an email): a boleto payer is identified by
// name + document and an optional postal address the bank prints on the slip.
export interface PagadorEndereco {
  readonly logradouro: string
  readonly numero: string
  readonly bairro: string
  readonly cidade: string
  readonly uf: string
  readonly cep: string
}

export interface Pagador {
  readonly nome: string
  readonly cpfCnpj: string
  readonly endereco?: PagadorEndereco
}
