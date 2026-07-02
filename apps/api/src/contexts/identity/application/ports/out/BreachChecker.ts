// ACL out-port for the "has this password leaked" check (HaveIBeenPwned range
// API, k-anonymity). Kept out of the pure PasswordPolicy because it needs the
// network. Fail-open is the adapter's responsibility: an HIBP outage resolves to
// `false` so it never blocks sign-up. Interface only; wired in main.
export interface BreachChecker {
  isCompromised(password: string): Promise<boolean>
}
