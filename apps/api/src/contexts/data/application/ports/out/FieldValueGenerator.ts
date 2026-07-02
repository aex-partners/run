import { Result } from '@/shared/kernel/Result'

// Driven port for the AI text generation behind entities.generateFieldValue. The
// concrete adapter (Anthropic SDK) lives under adapters/out; the application
// stays npm-free and deterministic in tests via a stub.
export interface FieldValueGenerator {
  generate(prompt: string): Promise<Result<string>>
}
