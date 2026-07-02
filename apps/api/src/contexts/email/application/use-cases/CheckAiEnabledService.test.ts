import { describe, it, expect } from 'vitest'
import { CheckAiEnabledService } from '@/contexts/email/application/use-cases/CheckAiEnabledService'
import { AiDrafter, AiDraftInput } from '@/contexts/email/application/ports/out/AiDrafter'

class FakeAiDrafter implements AiDrafter {
  constructor(private readonly enabled: boolean) {}
  async isEnabled(): Promise<boolean> {
    return this.enabled
  }
  async summarize(_body: string): Promise<string> {
    return ''
  }
  async draft(_input: AiDraftInput): Promise<string> {
    return ''
  }
}

describe('CheckAiEnabledService', () => {
  it('reports enabled when the AiDrafter is on', async () => {
    const service = new CheckAiEnabledService(new FakeAiDrafter(true))
    const res = await service.execute()
    expect(res.ok).toBe(true)
    expect(res.ok && res.value).toEqual({ enabled: true })
  })

  it('reports disabled when the AiDrafter is off', async () => {
    const service = new CheckAiEnabledService(new FakeAiDrafter(false))
    const res = await service.execute()
    expect(res.ok).toBe(true)
    expect(res.ok && res.value).toEqual({ enabled: false })
  })
})
