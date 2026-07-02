import { Result, ok, fail } from '@/shared/kernel/Result'
import { CheckPassword, CheckPasswordCommand } from '@/contexts/identity/application/ports/in/CheckPassword'
import { BreachChecker } from '@/contexts/identity/application/ports/out/BreachChecker'
import { PasswordPolicy } from '@/contexts/identity/domain/PasswordPolicy'

// The better-auth before-hook policy: pure complexity rules (domain) plus, on
// sign-up only, the HIBP breach check (out-port). Mirrors auth/index.ts.
export class CheckPasswordService implements CheckPassword {
  constructor(private readonly breaches: BreachChecker) {}

  async execute(cmd: CheckPasswordCommand): Promise<Result<void>> {
    const complexity = PasswordPolicy.validateComplexity(cmd.password)
    if (!complexity.ok) return complexity

    if (cmd.checkBreach && (await this.breaches.isCompromised(cmd.password))) {
      return fail(
        'This password has appeared in a known data breach. Please choose a different one.',
      )
    }
    return ok(undefined)
  }
}
