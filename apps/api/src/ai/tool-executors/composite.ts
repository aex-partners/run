/**
 * Composite tool executor: runs a sequence of tools, piping outputs.
 */
import { eq } from "drizzle-orm";
import { customTools } from "../../db/schema/index.js";
import { buildCustomTool } from "../tool-registry.js";
import type { ToolContext } from "../tools.js";

interface CompositeStep {
  toolName: string;
  inputMapping?: Record<string, string>;
}

function resolveInputMapping(
  mapping: Record<string, string> | undefined,
  args: Record<string, unknown>,
  previousResult: unknown,
): Record<string, unknown> {
  if (!mapping) {
    return typeof previousResult === "object" && previousResult !== null
      ? (previousResult as Record<string, unknown>)
      : args;
  }

  const resolved: Record<string, unknown> = {};
  for (const [key, source] of Object.entries(mapping)) {
    if (source.startsWith("args.")) {
      resolved[key] = args[source.slice(5)];
    } else if (source.startsWith("prev.")) {
      const path = source.slice(5);
      if (typeof previousResult === "object" && previousResult !== null) {
        resolved[key] = (previousResult as Record<string, unknown>)[path];
      }
    } else {
      resolved[key] = source;
    }
  }
  return resolved;
}

export async function executeComposite(
  args: Record<string, unknown>,
  config: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const steps = (config.steps as CompositeStep[]) ?? [];
  if (steps.length === 0) return { error: "Composite tool has no steps" };

  let lastResult: unknown = null;

  for (const step of steps) {
    const [toolRow] = await ctx.db
      .select()
      .from(customTools)
      .where(eq(customTools.name, step.toolName))
      .limit(1);

    if (!toolRow) return { error: `Tool "${step.toolName}" not found in composite step` };

    const builtTool = buildCustomTool(toolRow, ctx);
    const input = resolveInputMapping(step.inputMapping, args, lastResult);

    lastResult = await (builtTool as any).execute(input, { toolCallId: crypto.randomUUID() });
  }

  return lastResult;
}
