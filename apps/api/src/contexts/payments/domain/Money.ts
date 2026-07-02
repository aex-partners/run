// Pure BRL <-> centavos conversion. The AI and HTTP callers speak in reais (a
// decimal amount); the provider and the `Charge` model speak in integer
// centavos. Rounding to the nearest cent keeps float input (e.g. 19.99) exact.
export const Money = {
  reaisToCents(reais: number): number {
    return Math.round(reais * 100)
  },
  centsToReais(cents: number): number {
    return cents / 100
  },
  // "R$ 19,99" style formatting for human-facing tool output.
  formatBRL(cents: number): string {
    const reais = Money.centsToReais(cents)
    return `R$ ${reais.toFixed(2).replace('.', ',')}`
  },
}
