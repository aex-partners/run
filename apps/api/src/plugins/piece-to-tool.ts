/**
 * Converts ActivePieces piece actions into AI SDK tools.
 * This is the core bridge between the AP piece ecosystem and AEX's AI agent system.
 */

import { tool, jsonSchema } from "ai";
import type { Piece, Action } from "@activepieces/pieces-framework";
import { PropertyType } from "@activepieces/pieces-framework";
import { createActionContext } from "./context-factory.js";
import type { Database } from "../db/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AiTool = any;

interface PieceToolOptions {
  db: Database;
  piece: Piece;
  serverUrl: string;
  credentialValue?: unknown;
}

/**
 * Convert all actions from a piece into AI SDK tools.
 * Returns a map of toolName -> AI SDK tool.
 */
export function pieceActionsToTools(
  opts: PieceToolOptions,
): Record<string, AiTool> {
  const { piece, db, serverUrl, credentialValue } = opts;
  const result: Record<string, AiTool> = {};
  const pieceName = getPieceName(piece);
  const actions = piece.actions();

  for (const [actionName, action] of Object.entries(actions)) {
    try {
      const aiTool = actionToTool({
        action: action as Action,
        pieceName,
        db,
        serverUrl,
        credentialValue,
      });
      const toolName = sanitizeToolName(`${pieceName}_${actionName}`);
      result[toolName] = aiTool;
    } catch (err) {
      console.error(
        `Failed to convert action "${pieceName}:${actionName}" to tool:`,
        err,
      );
    }
  }

  return result;
}

/**
 * Convert a single piece action into an AI SDK tool.
 */
function actionToTool(opts: {
  action: Action;
  pieceName: string;
  db: Database;
  serverUrl: string;
  credentialValue?: unknown;
}): AiTool {
  const { action, pieceName, db, serverUrl, credentialValue } = opts;
  const schema = propsToJsonSchema(action.props ?? {});
  return tool({
    description: `${action.displayName}: ${action.description}`.slice(0, 1024),
    inputSchema: jsonSchema(schema),
    execute: async (args: Record<string, unknown>) => {
      const context = createActionContext({
        db,
        pluginName: pieceName,
        auth: credentialValue,
        propsValue: args,
        serverUrl,
      });

      try {
        const result = await action.run({
          ...context,
          executionType: "BEGIN" as unknown,
        } as Parameters<typeof action.run>[0]);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Action execution failed";
        return { error: message };
      }
    },
  });
}

/**
 * Convert AP property definitions to a JSON Schema object directly.
 * Using raw JSON Schema avoids Zod-to-JSON-Schema conversion issues.
 */
export function propsToJsonSchema(props: Record<string, unknown>): Record<string, unknown> {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const [key, propDef] of Object.entries(props)) {
    if (!propDef || typeof propDef !== "object") continue;
    const prop = propDef as {
      type: PropertyType;
      required?: boolean;
      displayName?: string;
      description?: string;
    };

    const propSchema = propertyTypeToJsonSchema(prop.type);

    if (prop.description) {
      propSchema.description = prop.description;
    } else if (prop.displayName) {
      propSchema.description = prop.displayName;
    }

    properties[key] = propSchema;

    if (prop.required) {
      required.push(key);
    }
  }

  const schema: Record<string, unknown> = {
    type: "object",
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

/**
 * Map an AP PropertyType to a JSON Schema type definition.
 */
function propertyTypeToJsonSchema(type: PropertyType): Record<string, unknown> {
  switch (type) {
    case PropertyType.SHORT_TEXT:
    case PropertyType.LONG_TEXT:
    case PropertyType.DATE_TIME:
    case PropertyType.COLOR:
      return { type: "string" };

    case PropertyType.NUMBER:
      return { type: "number" };

    case PropertyType.CHECKBOX:
      return { type: "boolean" };

    case PropertyType.JSON:
    case PropertyType.OBJECT:
    case PropertyType.DYNAMIC:
    case PropertyType.CUSTOM:
      return { type: "object", additionalProperties: true };

    case PropertyType.ARRAY:
    case PropertyType.MULTI_SELECT_DROPDOWN:
    case PropertyType.STATIC_MULTI_SELECT_DROPDOWN:
      return { type: "array", items: { type: "string" } };

    case PropertyType.DROPDOWN:
    case PropertyType.STATIC_DROPDOWN:
      return { type: "string" };

    case PropertyType.FILE:
      return { type: "string", description: "File URL or base64 content" };

    case PropertyType.MARKDOWN:
      return { type: "string" };

    default:
      return { type: "string" };
  }
}

/**
 * Sanitize a tool name so it only contains characters allowed by OpenAI: [a-zA-Z0-9_-]
 */
export function sanitizeToolName(name: string): string {
  return name
    .replace(/^@[^/]+\//, "")   // strip npm scope (e.g. @activepieces/)
    .replace(/^piece-/, "")      // strip "piece-" prefix
    .replace(/[^a-zA-Z0-9_-]/g, "_"); // replace any remaining invalid chars
}

/**
 * Extract the piece name from a Piece instance.
 */
function getPieceName(piece: Piece): string {
  try {
    const meta = piece.metadata();
    if (meta?.name) return meta.name;
  } catch {
    // metadata() may not exist on npm-installed pieces (different framework version)
  }
  return piece.displayName.toLowerCase().replace(/\s+/g, "-");
}
