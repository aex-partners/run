// Lifecycle of a charge as this context models it. Providers use many raw states
// (WAITING, AUTHORIZED, IN_ANALYSIS, DECLINED, ...); the adapter folds them onto
// this small, stable set so the application and the AI never see provider jargon.
export type ChargeStatus = 'pending' | 'paid' | 'canceled' | 'failed'
