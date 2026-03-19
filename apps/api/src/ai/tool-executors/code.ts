/**
 * Code tool executor: runs sandboxed JS via node:vm.
 * No access to process, require, fs, or any Node.js APIs.
 */
import vm from "node:vm";

export async function executeCode(
  args: Record<string, unknown>,
  config: Record<string, unknown>,
): Promise<unknown> {
  const code = config.code as string;
  if (!code) return { error: "Code tool missing code in config" };

  // Shared state for the sandbox to write results
  let resolvePromise: (value: unknown) => void;
  let rejectPromise: (reason: unknown) => void;
  const resultPromise = new Promise<unknown>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const sandbox = {
    args,
    __resolve: resolvePromise!,
    __reject: rejectPromise!,
    console: {
      log: (..._msgs: unknown[]) => {},
      error: (..._msgs: unknown[]) => {},
      warn: (..._msgs: unknown[]) => {},
    },
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    Promise,
    setTimeout: (_fn: () => void, _ms: number) => {
      // Disallow setTimeout inside sandbox
    },
  };

  const context = vm.createContext(sandbox);

  // Wrap user code in an async IIFE and pipe result/error to our promise
  const wrappedCode = `
    (async () => {
      ${code}
    })().then(r => __resolve(r)).catch(e => __reject(e));
  `;

  try {
    const script = new vm.Script(wrappedCode);
    script.runInContext(context, { timeout: 5000 });

    // Race the user code promise against a 5s timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      globalThis.setTimeout(() => reject(new Error("Code execution timed out (5s limit)")), 5000),
    );

    const result = await Promise.race([resultPromise, timeoutPromise]);
    return result ?? null;
  } catch (err) {
    if (err instanceof Error && err.message.includes("timed out")) {
      return { error: "Code execution timed out (5s limit)" };
    }
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
