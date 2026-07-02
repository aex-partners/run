import { Result } from '@/shared/kernel/Result'

// Driving port: create a backing "bot" user for an agent so it can act as a
// first-class actor (author messages, own tasks). Consumed by the agents context
// via an ACL bridge in main, so agents never touches the identity-owned users table.
export interface ProvisionBotUserInput {
  name: string
  email: string
  image: string | null
}

export interface ProvisionBotUser {
  execute(input: ProvisionBotUserInput): Promise<Result<{ userId: string }>>
}
