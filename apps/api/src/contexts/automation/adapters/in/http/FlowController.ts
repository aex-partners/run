import { Json } from '@/shared/domain/Json'
import { StartFlow } from '@/contexts/automation/application/ports/in/StartFlow'

export const flowController = (deps: { start: StartFlow }) => ({
  start: async (input: { flowId: string; input: Json }) => {
    const r = await deps.start.execute(input)
    if (!r.ok) throw new Error(r.error)
    return r.value
  },
})
