// SEFAZ environment the document is transmitted to. 'homologacao' is the sandbox
// (documents carry no fiscal value); 'producao' is live. Defaults to 'homologacao'
// everywhere so an accidental live emission is never the fallback.
export type Ambiente = 'homologacao' | 'producao'

export const isAmbiente = (v: unknown): v is Ambiente => v === 'homologacao' || v === 'producao'

// SEFAZ `tpAmb` code: 1 = produção, 2 = homologação.
export const tpAmb = (a: Ambiente): 1 | 2 => (a === 'producao' ? 1 : 2)
