import { Worker } from 'node:worker_threads'
import { Json } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { CodeSandbox } from '@/contexts/automation/application/ports/out/CodeSandbox'

// Real CodeSandbox: runs user JS in a worker thread, inside a fresh `vm` context
// with NO `require`/`process`/`fetch`/fs bindings, under a wall-clock timeout and
// a memory cap. The worker gives crash + runaway isolation (we terminate it); the
// vm context removes ambient host access. This is not a hardened isolate (a
// determined attacker can still escape a bare vm), but it removes the obvious
// foot-guns the Echo stub deferred. Contract: the user code runs as an async
// function body with `inputs` in scope; its `return` value becomes the step
// output. Anything non-JSON-serializable fails cleanly.
const TIMEOUT_MS = Number(process.env.CODE_SANDBOX_TIMEOUT_MS ?? 10_000)
const MAX_MEMORY_MB = Number(process.env.CODE_SANDBOX_MEMORY_MB ?? 128)

// Runs in the worker (plain JS, eval'd). Kept as a string so no build step /
// separate worker file is needed.
const WORKER_SCRIPT = `
const { parentPort, workerData } = require('worker_threads');
const vm = require('vm');
(async () => {
  try {
    const sandbox = {
      inputs: workerData.input,
      console: { log: () => {}, error: () => {}, warn: () => {}, info: () => {} },
      JSON, Math, Date, Object, Array, String, Number, Boolean, Promise, RegExp, Map, Set, Error,
      parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
    };
    vm.createContext(sandbox);
    const wrapped = '(async () => {\\n' + workerData.code + '\\n})()';
    const out = await vm.runInContext(wrapped, sandbox, { timeout: workerData.timeoutMs, filename: 'code-step.js' });
    // structured clone will throw on non-serializable values -> caught below
    parentPort.postMessage({ ok: true, value: out === undefined ? null : out });
  } catch (e) {
    parentPort.postMessage({ ok: false, error: String(e && e.message ? e.message : e) });
  }
})();
`

export class WorkerCodeSandbox implements CodeSandbox {
  run(call: { code: string; input: Json }): Promise<Result<Json>> {
    return new Promise<Result<Json>>((resolve) => {
      let settled = false
      const done = (r: Result<Json>) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        void worker.terminate()
        resolve(r)
      }

      const worker = new Worker(WORKER_SCRIPT, {
        eval: true,
        workerData: { code: call.code, input: call.input, timeoutMs: TIMEOUT_MS },
        resourceLimits: { maxOldGenerationSizeMb: MAX_MEMORY_MB },
      })

      const timer = setTimeout(
        () => done(fail(`Code step timed out after ${TIMEOUT_MS}ms`)),
        TIMEOUT_MS + 500,
      )

      worker.on('message', (msg: { ok: boolean; value?: Json; error?: string }) => {
        if (msg.ok) done(ok((msg.value ?? null) as Json))
        else done(fail(msg.error ?? 'Code step failed'))
      })
      worker.on('error', (err) => done(fail(err.message)))
      worker.on('exit', (code) => {
        if (code !== 0) done(fail(`Code worker exited with code ${code}`))
      })
    })
  }
}
