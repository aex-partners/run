// Wiring for the `skills` context. No cross-context construction-time dependencies.
// Exposes ResolveSkill, which the assistant AgentDirectory bridge expands into the
// system prompt + tool ids.
import { Infra } from '@/main/wiring/infra'

import { DrizzleSkillRepository } from '@/contexts/skills/adapters/out/persistence/DrizzleSkillRepository'
import { DrizzleGetSkill } from '@/contexts/skills/adapters/out/persistence/DrizzleGetSkill'
import { DrizzleListSkills } from '@/contexts/skills/adapters/out/persistence/DrizzleListSkills'
import { CreateSkillService } from '@/contexts/skills/application/use-cases/CreateSkillService'
import { UpdateSkillService } from '@/contexts/skills/application/use-cases/UpdateSkillService'
import { DeleteSkillService } from '@/contexts/skills/application/use-cases/DeleteSkillService'
import { skillController } from '@/contexts/skills/adapters/in/http/SkillController'
import { DrizzleResolveSkill } from '@/contexts/skills/adapters/out/persistence/DrizzleResolveSkill'

export function wireSkills(infra: Infra) {
  const { db, events, clock } = infra
  const skillRepo = new DrizzleSkillRepository(db)
  const getSkill = new DrizzleGetSkill(db)
  const listSkills = new DrizzleListSkills(db)
  const createSkill = new CreateSkillService(skillRepo, events, clock)
  const updateSkill = new UpdateSkillService(skillRepo, events, clock)
  const deleteSkill = new DeleteSkillService(skillRepo, events, clock)
  const skillsCtl = skillController({ list: listSkills, getById: getSkill, create: createSkill, update: updateSkill, delete: deleteSkill })
  const resolveSkill = new DrizzleResolveSkill(db) // skills ResolveSkill in-port, for the assistant AgentDirectory bridge
  return { controller: skillsCtl, ports: { resolveSkill } }
}

export type SkillsWiring = ReturnType<typeof wireSkills>
