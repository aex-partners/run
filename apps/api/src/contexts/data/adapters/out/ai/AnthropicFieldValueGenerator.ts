import Anthropic from '@anthropic-ai/sdk'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { FieldValueGenerator } from '@/contexts/data/application/ports/out/FieldValueGenerator'

// REAL driven adapter for entities.generateFieldValue's text generation. Wraps
// the Anthropic SDK's Messages API. Ports AEX's generateFieldValue model call
// (system prompt + single user turn), returning ONLY the generated value.
export class AnthropicFieldValueGenerator implements FieldValueGenerator {
  constructor(
    private readonly apiKey: string | undefined = process.env.ANTHROPIC_API_KEY,
    private readonly model = 'claude-opus-4-8',
  ) {}

  async generate(prompt: string): Promise<Result<string>> {
    if (!this.apiKey) {
      return fail('ANTHROPIC_API_KEY is not configured for AI field generation.')
    }
    try {
      const anthropic = new Anthropic({ apiKey: this.apiKey })
      const response = await anthropic.messages.create({
        model: this.model,
        max_tokens: 256,
        system:
          'You are a field value generator for a database record. Return ONLY the generated value with no explanation, formatting, or surrounding quotes.',
        messages: [{ role: 'user', content: prompt }],
      })
      const first = response.content[0]
      const text = first && first.type === 'text' ? first.text : ''
      return ok(text)
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err))
    }
  }
}
