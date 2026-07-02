import { createHash } from 'node:crypto'
import { BreachChecker } from '@/contexts/identity/application/ports/out/BreachChecker'

// Real HIBP adapter, ported from auth/password-policy.ts. k-anonymity: only the
// first 5 chars of the SHA-1 hash leave the process. Fail-open: any network or
// parse error resolves to `false` so an HIBP outage never blocks sign-up.
export class HibpBreachChecker implements BreachChecker {
  async isCompromised(password: string): Promise<boolean> {
    try {
      const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
      const prefix = sha1.slice(0, 5)
      const suffix = sha1.slice(5)

      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'AEX-Password-Checker' },
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) return false

      const body = await res.text()
      for (const line of body.split('\n')) {
        const hashSuffix = line.split(':')[0]?.trim().toUpperCase()
        if (hashSuffix === suffix) return true
      }
      return false
    } catch {
      return false
    }
  }
}
