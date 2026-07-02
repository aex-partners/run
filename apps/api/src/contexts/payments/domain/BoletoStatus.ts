// Lifecycle of a boleto as this context models it. Sicredi (and other banks) use
// many raw states (EMITIDO, REGISTRADO, LIQUIDADO, BAIXADO, VENCIDO, ...); the
// adapter folds them onto this small, stable set so the application and the AI
// (Eric) never see bank jargon. `registered` = registered at the bank and awaiting
// payment; `paid` = settled; `canceled` = written off / baixado; `expired` = past
// due without payment; `failed` = registration rejected by the bank.
export type BoletoStatus = 'registered' | 'paid' | 'canceled' | 'expired' | 'failed'
