import { Result } from '@/shared/kernel/Result'

// Driving port. Finds or creates the caller's private Eric (AI) conversation,
// returning its id. Fails if no "eric" agent exists. Exposed for OTHER contexts:
// the identity flow provisions an Eric conversation for new users via this port.
export interface EnsureEricCommand {
  userId: string
}

export interface EnsureEric {
  execute(cmd: EnsureEricCommand): Promise<Result<{ id: string }>>
}
