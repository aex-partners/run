import { describe, it, expect } from 'vitest'
import { CheckPasswordService } from '@/contexts/identity/application/use-cases/CheckPasswordService'
import { BreachChecker } from '@/contexts/identity/application/ports/out/BreachChecker'

// Inline fake: records calls and returns a configured verdict.
class FakeBreachChecker implements BreachChecker {
  calls: string[] = []
  constructor(private compromised: boolean) {}
  async isCompromised(password: string): Promise<boolean> {
    this.calls.push(password)
    return this.compromised
  }
}

const STRONG = 'Str0ng!Passw0rd' // passes complexity

describe('CheckPasswordService', () => {
  it('passes a strong password when no breach check is requested', async () => {
    const breaches = new FakeBreachChecker(true) // would fail if consulted
    const svc = new CheckPasswordService(breaches)
    const r = await svc.execute({ password: STRONG, checkBreach: false })
    expect(r.ok).toBe(true)
    expect(breaches.calls).toHaveLength(0) // breach check skipped
  })

  it('consults the breach checker on sign-up (checkBreach=true) and passes when clean', async () => {
    const breaches = new FakeBreachChecker(false)
    const svc = new CheckPasswordService(breaches)
    const r = await svc.execute({ password: STRONG, checkBreach: true })
    expect(r.ok).toBe(true)
    expect(breaches.calls).toEqual([STRONG])
  })

  it('fails with the breach message when the password is compromised', async () => {
    const breaches = new FakeBreachChecker(true)
    const svc = new CheckPasswordService(breaches)
    const r = await svc.execute({ password: STRONG, checkBreach: true })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('known data breach')
  })

  it('fails on complexity before reaching the breach checker (short-circuit)', async () => {
    const breaches = new FakeBreachChecker(false)
    const svc = new CheckPasswordService(breaches)
    const r = await svc.execute({ password: 'weak', checkBreach: true })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('at least')
    expect(breaches.calls).toHaveLength(0) // never consulted
  })

  it('returns the complexity error verbatim from the policy', async () => {
    const svc = new CheckPasswordService(new FakeBreachChecker(false))
    const r = await svc.execute({ password: 'alllowercase1!aa', checkBreach: false })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Password must contain an uppercase letter.')
  })
})
