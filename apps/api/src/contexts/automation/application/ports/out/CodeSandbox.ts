import { Json } from '@/shared/domain/Json'
import { Result } from '@/shared/kernel/Result'

// Driven port for the ONE irreducible impurity: running arbitrary user code. The
// domain only knows "transform input -> output via an opaque gateway". Isolation,
// timeouts and memory limits are the adapter's job (isolate-vm / worker / WASM).
export interface CodeSandbox {
  run(call: { code: string; input: Json }): Promise<Result<Json>>
}
