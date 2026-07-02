// Spend / Budget VO. The daily per-user Anthropic spend cap, ported PURE from
// spend-tracker.ts. The reading and writing of the counter is a driven port
// (SpendStore); the RULE — am I over budget, and what do I tell the user — lives
// here with no IO.

export class Budget {
  private constructor(private readonly dailyUsd: number) {}

  static daily(dailyUsd: number): Budget {
    return new Budget(dailyUsd)
  }

  limitUsd(): number {
    return this.dailyUsd
  }

  isExceeded(spentUsd: number): boolean {
    return spentUsd >= this.dailyUsd
  }

  exceededMessage(spentUsd: number): string {
    return (
      `Daily AI spend limit reached: $${spentUsd.toFixed(4)} / $${this.dailyUsd.toFixed(2)}. ` +
      `Try again tomorrow or ask an admin to raise the daily budget.`
    )
  }
}
