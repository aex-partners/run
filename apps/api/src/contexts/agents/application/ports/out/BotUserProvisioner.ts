// ACL out-port to the IDENTITY context. Creating an agent provisions a backing
// "bot" user so the agent can act as a first-class actor (author messages, own
// tasks) — realizing the `agents.user_id` link the schema reserves. The agents
// context never imports identity; main bridges this to identity's user-creation
// in-port. Interface only.
export interface ProvisionBotInput {
  name: string
  avatar: string | null
  agentId: string
}

export interface BotUserProvisioner {
  provision(input: ProvisionBotInput): Promise<{ userId: string }>
}
