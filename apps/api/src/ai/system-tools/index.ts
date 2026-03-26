import type { ToolContext } from "../types.js";
import { buildEntityTools } from "./entity-tools.js";

export function buildAllSystemTools(ctx: ToolContext) {
  return [
    ...buildEntityTools(ctx),
  ];
}
