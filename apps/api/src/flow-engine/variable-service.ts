/**
 * Variable resolution service.
 * Resolves {{step_name.output.field}} expressions in action inputs.
 */

const VARIABLE_PATTERN = /\{\{(.+?)\}\}/g;

/**
 * Resolve all variable references in an input value.
 * Supports nested objects/arrays and string interpolation.
 */
export function resolveVariables(
  input: unknown,
  state: Record<string, unknown>,
): unknown {
  if (input === null || input === undefined) return input;

  if (typeof input === "string") {
    return resolveString(input, state);
  }

  if (Array.isArray(input)) {
    return input.map((item) => resolveVariables(item, state));
  }

  if (typeof input === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      result[key] = resolveVariables(value, state);
    }
    return result;
  }

  return input;
}

/**
 * Resolve a string that may contain {{variable}} references.
 */
function resolveString(str: string, state: Record<string, unknown>): unknown {
  // Check if the entire string is a single variable reference
  const singleMatch = str.match(/^\{\{(.+?)\}\}$/);
  if (singleMatch) {
    // Return the resolved value directly (preserves type)
    return evaluatePath(singleMatch[1].trim(), state);
  }

  // String interpolation: replace all {{...}} with resolved values
  return str.replace(VARIABLE_PATTERN, (_, path) => {
    const value = evaluatePath(path.trim(), state);
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Evaluate a dot-path expression against the state object.
 * Supports: step_1.output.field, step_1.output[0].name, etc.
 */
function evaluatePath(path: string, state: Record<string, unknown>): unknown {
  const parts = parsePath(path);
  let current: unknown = state;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    if (typeof current !== "object") return undefined;

    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      if (isNaN(index)) return undefined;
      current = current[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

/**
 * Parse a path string into parts.
 * "step_1.output.items[0].name" -> ["step_1", "output", "items", "0", "name"]
 */
function parsePath(path: string): string[] {
  const parts: string[] = [];
  let current = "";

  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === ".") {
      if (current) parts.push(current);
      current = "";
    } else if (ch === "[") {
      if (current) parts.push(current);
      current = "";
    } else if (ch === "]") {
      if (current) parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  if (current) parts.push(current);
  return parts;
}
