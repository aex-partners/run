import type { ToolContext } from "../types.js";
import { buildEntityTools } from "./entity-tools.js";
import { buildKnowledgeTools } from "./knowledge-tools.js";
import { buildSearchTools } from "./search-tools.js";

export function buildAllSystemTools(ctx: ToolContext) {
  return [
    ...buildEntityTools(ctx),
    ...buildKnowledgeTools(ctx),
    ...buildSearchTools(),
  ];
}
