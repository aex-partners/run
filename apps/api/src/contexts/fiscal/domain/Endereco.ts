// A Brazilian postal address as the fiscal context models it, independent of the
// SEFAZ `enderEmit`/`enderDest` XML shape (the adapter maps to those field names).
// `codigoMunicipio` is the 7-digit IBGE municipality code (SEFAZ `cMun`/`cMunFG`);
// it is required to emit but optional here so a partially-filled config can still
// be validated with a clear error rather than a type mismatch.
export interface Endereco {
  readonly logradouro: string
  readonly numero: string
  readonly bairro: string
  readonly municipio: string
  readonly codigoMunicipio?: string
  readonly uf: string
  readonly cep: string
  readonly complemento?: string
}
