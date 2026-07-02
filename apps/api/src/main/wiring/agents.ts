// Wiring for the `agents` context. The BotUserProvisioner ACL bridge writes the
// backing bot user straight into the shared `users` table (identity exposes no
// provisioning in-port; pragmatic shared-DB), so this builder touches `schema`
// directly in main. Exposes CreateAgent (settings seeds the default Eric agent)
// and ResolveAgent (the assistant AgentDirectory bridge).
import { Infra } from '@/main/wiring/infra'

import { DrizzleAgentRepository } from '@/contexts/agents/adapters/out/persistence/DrizzleAgentRepository'
import { DrizzleGetAgent } from '@/contexts/agents/adapters/out/persistence/DrizzleGetAgent'
import { DrizzleListAgents } from '@/contexts/agents/adapters/out/persistence/DrizzleListAgents'
import { CreateAgentService } from '@/contexts/agents/application/use-cases/CreateAgentService'
import { UpdateAgentService } from '@/contexts/agents/application/use-cases/UpdateAgentService'
import { DeleteAgentService } from '@/contexts/agents/application/use-cases/DeleteAgentService'
import { ResolveAgentService } from '@/contexts/agents/application/use-cases/ResolveAgentService'
import { agentsController } from '@/contexts/agents/adapters/in/http/AgentsController'
import { BotUserProvisioner } from '@/contexts/agents/application/ports/out/BotUserProvisioner'
import { ProvisionBotUser } from '@/contexts/identity/application/ports/in/ProvisionBotUser'

export function wireAgents(infra: Infra, provisionBotUser: ProvisionBotUser) {
  const { db, events, clock } = infra

  // ACL bridge: agents BotUserProvisioner -> identity ProvisionBotUser in-port.
  // Bot-user creation now lives in the identity context (no foreign-table write).
  const botUserProvisioner: BotUserProvisioner = {
    provision: async ({ name, avatar, agentId }) => {
      const r = await provisionBotUser.execute({
        name,
        email: `agent-${agentId}@bots.local`,
        image: avatar ?? null,
      })
      if (!r.ok) throw new Error(`provision bot user: ${r.error}`)
      return r.value
    },
  }
  const agentRepo = new DrizzleAgentRepository(db)
  const getAgent = new DrizzleGetAgent(db)
  const listAgents = new DrizzleListAgents(db)
  const createAgent = new CreateAgentService(agentRepo, botUserProvisioner, events, clock)
  const updateAgent = new UpdateAgentService(agentRepo, events, clock)
  const deleteAgent = new DeleteAgentService(agentRepo, events, clock)
  const resolveAgent = new ResolveAgentService(agentRepo)
  const agentsCtl = agentsController({ list: listAgents, get: getAgent, create: createAgent, update: updateAgent, remove: deleteAgent })

  return { controller: agentsCtl, ports: { createAgent, resolveAgent } }
}

export type AgentsWiring = ReturnType<typeof wireAgents>
