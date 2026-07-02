import { Json } from '@/shared/domain/Json'
import { Result, ok } from '@/shared/kernel/Result'
import { CodeSandbox } from '@/contexts/automation/application/ports/out/CodeSandbox'

// Placeholder driven adapter. A real implementation runs `code` in an isolated
// VM (isolate-vm / worker_threads / WASM) with CPU + memory limits and no
// ambient network or fs. Here we just echo the input so the skeleton runs
// without a sandbox runtime. The security boundary is THIS adapter's concern —
// the domain never sees it.
export class EchoCodeSandbox implements CodeSandbox {
  async run(call: { code: string; input: Json }): Promise<Result<Json>> {
    return ok({ echoedFrom: 'code-step', input: call.input })
  }
}
