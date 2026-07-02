// How a charge is collected. PagSeguro/PagBank settles both, but the payload and
// the artefact returned to the payer differ (a boleto line vs a PIX QR code).
export type ChargeMethod = 'boleto' | 'pix'

export const isChargeMethod = (v: unknown): v is ChargeMethod => v === 'boleto' || v === 'pix'
